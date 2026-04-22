import type { OrderLine } from "@/types/orders";

/** Ordena líneas según el orden de pestañas de la carta (p. ej. comida antes que bebidas). */
export function sortOrderLinesByMenuTab(
  lines: OrderLine[],
  menuTabByItemId: Record<string, string>,
  tabOrder: string[],
): OrderLine[] {
  if (!tabOrder.length) return lines;
  const rank = (menuItemId: string) => {
    const tab = menuTabByItemId[menuItemId];
    const idx = tab ? tabOrder.indexOf(tab) : -1;
    return idx === -1 ? 999 : idx;
  };
  return [...lines].sort((a, b) => {
    const d = rank(a.menuItemId) - rank(b.menuItemId);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
