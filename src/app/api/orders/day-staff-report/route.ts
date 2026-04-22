import { NextResponse } from "next/server";

import { buildStaffDayReport } from "@/lib/day-staff-report";
import { jsonErrorFromException } from "@/lib/api-error-response";
import { listOrdersForCalendarDay } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import { getRestaurantTimeZone, todayCalendarDateKey } from "@/lib/timezone";

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
  try {
    const orders = await listOrdersForCalendarDay(dayRaw, tz);
    const byStaff = buildStaffDayReport(orders);
    return NextResponse.json(
      { day: dayRaw, timeZone: tz, byStaff },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}
