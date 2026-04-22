import fs from "fs";
import path from "path";

import { MERAKI_MENU } from "@/data/meraki-menu";
import type { MenuItem, MenuTab } from "@/types/menu";

const MENU_FILE = path.join(process.cwd(), "data", "menu.json");

function readDiskTabs(): MenuTab[] | null {
  if (!fs.existsSync(MENU_FILE)) return null;
  try {
    const raw = fs.readFileSync(MENU_FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && Array.isArray((data as { tabs?: unknown }).tabs)) {
      return (data as { tabs: MenuTab[] }).tabs;
    }
    if (Array.isArray(data)) {
      return data as MenuTab[];
    }
  } catch {
    return null;
  }
  return null;
}

export function getMenuTabs(): MenuTab[] {
  return readDiskTabs() ?? MERAKI_MENU;
}

export function refreshMenuCache() {
  /* no-op: lecturas siguen yendo a disco */
}

export function getMenuItemById(id: string): MenuItem | undefined {
  const tabs = getMenuTabs();
  for (const tab of tabs) {
    for (const sec of tab.sections) {
      const found = sec.items.find((it) => it.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
