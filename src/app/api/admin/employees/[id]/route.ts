import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { setEmployeeActive } from "@/lib/employees-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Id no válido" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la petición" }, { status: 400 });
  }
  const active = (body as { active?: unknown }).active;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Falta active (boolean)" }, { status: 400 });
  }
  try {
    await setEmployeeActive(id.trim(), active);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "Empleado no encontrado.") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return jsonErrorFromException(e);
  }
}
