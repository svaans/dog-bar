import type { MenuTab } from "@/types/menu";

/** `menuItemId` → id de pestaña (`comida`, `bebidas`, …). */
export function buildTabIdMap(tabs: MenuTab[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tab of tabs) {
    for (const sec of tab.sections) {
      for (const it of sec.items) {
        out[it.id] = tab.id;
      }
    }
  }
  return out;
}
