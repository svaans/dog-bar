import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { readAllOrdersSnapshot } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let orders;
  try {
    orders = await readAllOrdersSnapshot();
  } catch (e) {
    return jsonErrorFromException(e);
  }
  const body = JSON.stringify(orders, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meraki-backup-pedidos-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
