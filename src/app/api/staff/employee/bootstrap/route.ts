import { NextResponse } from "next/server";

import { countActiveEmployees, getActiveEmployeeById } from "@/lib/employees-store";
import { getEmployeeSessionFromCookies } from "@/lib/employee-session";
import { jsonErrorFromException } from "@/lib/api-error-response";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const profilesEnabled = (await countActiveEmployees()) > 0;
    const sess = await getEmployeeSessionFromCookies();
    let employee = null;
    if (profilesEnabled && sess) {
      const emp = await getActiveEmployeeById(sess.sub);
      if (emp) employee = emp;
    }
    return NextResponse.json(
      { profilesEnabled, employee },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}
