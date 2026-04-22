import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { jsonErrorFromException } from "@/lib/api-error-response";
import {
  EMPLOYEE_SESSION_COOKIE,
  buildSessionPayload,
  signEmployeeSession,
} from "@/lib/employee-session";
import { verifyEmployeeLogin } from "@/lib/employees-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la petición" }, { status: 400 });
  }
  const b = body as { employeeNumber?: unknown; pin?: unknown };
  const employeeNumber =
    typeof b.employeeNumber === "number"
      ? b.employeeNumber
      : typeof b.employeeNumber === "string"
        ? parseInt(b.employeeNumber, 10)
        : NaN;
  const pin = typeof b.pin === "string" ? b.pin : "";
  if (!Number.isFinite(employeeNumber) || employeeNumber < 1 || employeeNumber > 999) {
    return NextResponse.json({ error: "Número de empleado no válido" }, { status: 400 });
  }
  if (!pin.trim()) {
    return NextResponse.json({ error: "PIN no válido" }, { status: 400 });
  }
  try {
    const row = await verifyEmployeeLogin(employeeNumber, pin);
    if (!row) {
      return NextResponse.json({ error: "Número o PIN incorrectos" }, { status: 401 });
    }
    const token = signEmployeeSession(
      buildSessionPayload({
        id: row.id,
        employeeNumber: row.employeeNumber,
        displayName: row.displayName,
      }),
    );
    const jar = await cookies();
    jar.set(EMPLOYEE_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return NextResponse.json(
      {
        ok: true,
        employee: {
          id: row.id,
          employeeNumber: row.employeeNumber,
          displayName: row.displayName,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}
