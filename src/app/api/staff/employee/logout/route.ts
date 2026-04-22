import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { EMPLOYEE_SESSION_COOKIE } from "@/lib/employee-session";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const jar = await cookies();
  jar.delete(EMPLOYEE_SESSION_COOKIE);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
