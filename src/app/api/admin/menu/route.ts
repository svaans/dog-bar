import fs from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { refreshMenuCache } from "@/lib/menu-loader";
import { validateMenuTabs } from "@/lib/menu-validate";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";

export const runtime = "nodejs";

const MENU_FILE = path.join(process.cwd(), "data", "menu.json");

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
  const tabs = (body as { tabs?: unknown })?.tabs;
  const result = validateMenuTabs(tabs, "es");
  if (!result.ok) {
    return NextResponse.json(
      { error: result.errors[0] ?? "Carta no válida", errors: result.errors },
      { status: 400 },
    );
  }
  try {
    if (!fs.existsSync(path.dirname(MENU_FILE))) {
      fs.mkdirSync(path.dirname(MENU_FILE), { recursive: true });
    }
    fs.writeFileSync(MENU_FILE, JSON.stringify({ tabs: result.tabs }, null, 2), "utf8");
  } catch (e) {
    return jsonErrorFromException(e);
  }
  refreshMenuCache();
  return NextResponse.json({ ok: true });
}
