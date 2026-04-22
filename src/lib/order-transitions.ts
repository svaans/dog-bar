import type { OrderStatus } from "@/types/orders";

/**
 * Cambios de estado permitidos al personal (avance, retroceso y correcciones).
 */
export function isAllowedStaffStatusChange(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return true;

  const forward: Partial<Record<OrderStatus, OrderStatus>> = {
    nuevo: "preparando",
    preparando: "listo",
    listo: "entregado",
  };

  const backward: Partial<Record<OrderStatus, OrderStatus>> = {
    preparando: "nuevo",
    listo: "preparando",
  };

  if (forward[from] === to) return true;
  if (backward[from] === to) return true;

  if (from === "nuevo" && to === "cancelado") return true;
  if (from === "preparando" && to === "cancelado") return true;
  if (from === "listo" && to === "cancelado") return true;

  if (from === "entregado" && to === "listo") return true;
  if (from === "cancelado" && to === "nuevo") return true;

  return false;
}
