import type { Order, OrderStatus } from "@/types/orders";

export type OrderDaySummary = {
  orderCount: number;
  byStatus: Record<OrderStatus, number>;
  /** Suma de líneas con precio conocido (€). */
  knownTotalEuros: number;
  /** Unidades de líneas sin precio (p. ej. copas «en barra»). */
  unitsWithoutKnownPrice: number;
  /** Suma de cantidades de todas las líneas. */
  totalUnits: number;
};

function emptyByStatus(): Record<OrderStatus, number> {
  return {
    nuevo: 0,
    preparando: 0,
    listo: 0,
    entregado: 0,
    cancelado: 0,
  };
}

export function summarizeOrders(orders: Order[]): OrderDaySummary {
  const byStatus = emptyByStatus();
  let knownTotalEuros = 0;
  let unitsWithoutKnownPrice = 0;
  let totalUnits = 0;

  for (const o of orders) {
    byStatus[o.status] += 1;
    for (const l of o.lines) {
      totalUnits += l.quantity;
      if (l.unitPriceEuros === null) {
        unitsWithoutKnownPrice += l.quantity;
      } else {
        knownTotalEuros += l.unitPriceEuros * l.quantity;
      }
    }
  }

  return {
    orderCount: orders.length,
    byStatus,
    knownTotalEuros,
    unitsWithoutKnownPrice,
    totalUnits,
  };
}
