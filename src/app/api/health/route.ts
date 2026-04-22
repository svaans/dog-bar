import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Comprobación mínima para balanceadores / Render. */
export function GET() {
  return NextResponse.json(
    { ok: true, service: "meraki-dog-bar", at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
