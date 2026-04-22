import { NextResponse } from "next/server";

import { getMenuTabs } from "@/lib/menu-loader";

export const runtime = "nodejs";

export async function GET() {
  const tabs = getMenuTabs();
  return NextResponse.json({ tabs });
}
