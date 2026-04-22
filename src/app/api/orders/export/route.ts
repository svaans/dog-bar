import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { buildOrdersLinesCsv } from "@/lib/orders-csv";
import { listOrdersForCalendarDay } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import {
  getRestaurantTimeZone,
  todayCalendarDateKey,
} from "@/lib/timezone";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const tz = getRestaurantTimeZone();
  const dayRaw = url.searchParams.get("day")?.trim() || todayCalendarDateKey(tz);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayRaw)) {
    return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  }

  let orders;
  try {
    orders = await listOrdersForCalendarDay(dayRaw, tz);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  const csv = buildOrdersLinesCsv(orders, tz);
  const filename = `meraki-pedidos-${dayRaw}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
