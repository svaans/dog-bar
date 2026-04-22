export type StaffViewRole = "todos" | "cocina" | "sala";

export type LineStation = "cocina" | "sala" | "desconocido";

export function stationForMenuItem(
  menuItemId: string,
  tabByItemId: Record<string, string>,
): LineStation {
  const tab = tabByItemId[menuItemId];
  if (!tab) return "desconocido";
  if (tab === "comida" || tab === "postres") return "cocina";
  if (tab === "bebidas" || tab === "copas" || tab === "mascotas") return "sala";
  return "desconocido";
}

/** Estilo de énfasis según rol (el pedido completo sigue siendo compartido entre cocina y sala). */
export function lineEmphasisClass(
  menuItemId: string,
  role: StaffViewRole,
  tabByItemId: Record<string, string>,
): string {
  if (role === "todos") return "";
  const s = stationForMenuItem(menuItemId, tabByItemId);
  const emphasis =
    role === "cocina"
      ? s === "cocina" || s === "desconocido"
      : s === "sala" || s === "desconocido";
  return emphasis
    ? "font-semibold text-[#2c1f14]"
    : "text-[#5c432e]/50";
}
