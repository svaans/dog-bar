import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { replaceAllOrders } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

/**
 * Borra **todos** los pedidos del almacén (activos e historial).
 * Solo personal autenticado. Pensado para pruebas / reset del local.
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
  const confirm = (body as { confirm?: unknown })?.confirm;
  if (confirm !== "BORRAR_TODO") {
    return NextResponse.json(
      { error: 'Envía JSON { "confirm": "BORRAR_TODO" } para confirmar.' },
      { status: 400 },
    );
  }
  try {
    await replaceAllOrders([]);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
