import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { summarizeOrders } from "@/lib/order-stats";
import { listOrdersForCalendarDay } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import { getRestaurantTimeZone, todayCalendarDateKey } from "@/lib/timezone";

export const runtime = "nodejs";

/**
 * Cuenta del día para una mesa: suma de líneas con precio conocido, excluye cancelados.
 * Pensado para sala (mesero): ver cuánto va y cuántos pedidos hay.
 */
export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const mesaRaw = url.searchParams.get("mesa")?.trim() || "";
  const mesa = parseInt(mesaRaw, 10);
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    return NextResponse.json({ error: "Mesa no válida" }, { status: 400 });
  }
  const tz = getRestaurantTimeZone();
  const day = todayCalendarDateKey(tz);
  try {
    const orders = await listOrdersForCalendarDay(day, tz);
    const mesaOrders = orders.filter((o) => o.mesa === mesa);
    const summary = summarizeOrders(mesaOrders);
    return NextResponse.json(
      {
        day,
        timeZone: tz,
        mesa,
        orderCount: summary.orderCount,
        knownTotalEuros: Math.round(summary.knownTotalEuros * 100) / 100,
        byStatus: summary.byStatus,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}

