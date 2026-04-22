import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { summarizeOrders } from "@/lib/order-stats";
import { readAllOrdersSnapshot, replaceAllOrders } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import { calendarDateKeyInZone, getRestaurantTimeZone, todayCalendarDateKey } from "@/lib/timezone";

export const runtime = "nodejs";

/**
 * Cierra cuenta de una mesa: borra los pedidos del día de esa mesa.
 * Devuelve resumen para imprimir/cobrar. Pensado para sala.
 */
export async function POST(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mesaRaw = (body as { mesa?: unknown }).mesa;
  const mesa =
    typeof mesaRaw === "number"
      ? mesaRaw
      : typeof mesaRaw === "string"
        ? parseInt(mesaRaw, 10)
        : NaN;
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    return NextResponse.json({ error: "Mesa no válida" }, { status: 400 });
  }
  const confirm = (body as { confirm?: unknown }).confirm;
  if (confirm !== "CERRAR_MESA") {
    return NextResponse.json(
      { error: 'Envía JSON { "mesa": <n>, "confirm": "CERRAR_MESA" } para confirmar.' },
      { status: 400 },
    );
  }

  const tz = getRestaurantTimeZone();
  const day = todayCalendarDateKey(tz);
  try {
    const all = await readAllOrdersSnapshot();
    const keep = [];
    const removed = [];
    for (const o of all) {
      const isToday = calendarDateKeyInZone(o.createdAt, tz) === day;
      if (isToday && o.mesa === mesa) removed.push(o);
      else keep.push(o);
    }
    await replaceAllOrders(keep);
    const summary = summarizeOrders(removed);
    return NextResponse.json(
      {
        ok: true,
        mesa,
        day,
        timeZone: tz,
        removedOrders: removed.length,
        knownTotalEuros: Math.round(summary.knownTotalEuros * 100) / 100,
        byStatus: summary.byStatus,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}

