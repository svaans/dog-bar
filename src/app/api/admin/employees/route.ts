import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { createEmployee, listEmployeesForAdminWithActive } from "@/lib/employees-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const employees = await listEmployeesForAdminWithActive();
    return NextResponse.json({ employees }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonErrorFromException(e);
  }
}

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
  const b = body as { employeeNumber?: unknown; displayName?: unknown; pin?: unknown };
  const employeeNumber =
    typeof b.employeeNumber === "number"
      ? b.employeeNumber
      : typeof b.employeeNumber === "string"
        ? parseInt(b.employeeNumber, 10)
        : NaN;
  const displayName = typeof b.displayName === "string" ? b.displayName : "";
  const pin = typeof b.pin === "string" ? b.pin : "";
  try {
    const row = await createEmployee({ employeeNumber, displayName, pin });
    return NextResponse.json(
      {
        ok: true,
        employee: {
          id: row.id,
          employeeNumber: row.employeeNumber,
          displayName: row.displayName,
          active: row.active,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (
      msg === "Nombre vacío" ||
      msg === "Número de empleado no válido" ||
      msg === "El PIN debe ser solo dígitos, entre 4 y 12." ||
      msg === "Ese número de empleado ya existe."
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return jsonErrorFromException(e);
  }
}
