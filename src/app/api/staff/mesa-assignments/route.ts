import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { joinStaffMesa, leaveStaffMesa, listStaffMesaAssignmentsFresh } from "@/lib/staff-mesa-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(_req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(_req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const assignments = await listStaffMesaAssignmentsFresh();
    return NextResponse.json(
      { assignments },
      { headers: { "Cache-Control": "no-store" } },
    );
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
  const b = body as { action?: unknown; mesa?: unknown; staffName?: unknown };
  const action = b.action === "join" || b.action === "leave" ? b.action : null;
  const mesa =
    typeof b.mesa === "number"
      ? b.mesa
      : typeof b.mesa === "string"
        ? parseInt(b.mesa, 10)
        : NaN;
  const staffName = typeof b.staffName === "string" ? b.staffName : "";
  if (!action) {
    return NextResponse.json({ error: "Acción no válida (join | leave)" }, { status: 400 });
  }
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    return NextResponse.json({ error: "Mesa no válida" }, { status: 400 });
  }
  try {
    if (action === "join") {
      await joinStaffMesa(mesa, staffName);
    } else {
      await leaveStaffMesa(mesa, staffName);
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "Nombre vacío") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return jsonErrorFromException(e);
  }
}
