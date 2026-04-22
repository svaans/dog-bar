import type { Order, OrderStatus } from "@/types/orders";

export type StaffDayReportRow = {
  /** Clave estable para agrupar (minúsculas). */
  staffKey: string;
  /** Nombre mostrado (primera forma vista). */
  displayName: string;
  deliveries: number;
  tables: number[];
  revenueEuros: number;
};

function orderKnownRevenueEuros(order: Order): number {
  let sum = 0;
  for (const l of order.lines) {
    if (l.unitPriceEuros !== null) sum += l.unitPriceEuros * l.quantity;
  }
  return Math.round(sum * 100) / 100;
}

/** Actor que marcó el paso a entregado (primera transición a entregado en el log). */
export function deliveryActorForReport(order: Order): string | undefined {
  const log = [...(order.statusLog ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  let prev: OrderStatus | undefined;
  for (const e of log) {
    if (e.status === "entregado" && prev !== "entregado") {
      const a = e.actor?.trim();
      if (a) return a;
      const ln = order.lastActorName?.trim();
      if (ln) return ln;
      return undefined;
    }
    prev = e.status;
  }
  if (order.status === "entregado") {
    return order.lastActorName?.trim() || undefined;
  }
  return undefined;
}

/**
 * Informe del día: solo pedidos **entregados**; ingreso = suma de líneas con precio conocido.
 * Personal identificado por quien figura al pasar a entregado (log o último actor).
 */
export function buildStaffDayReport(orders: Order[]): StaffDayReportRow[] {
  const map = new Map<
    string,
    { displayName: string; deliveries: number; tables: Set<number>; revenueEuros: number }
  >();

  for (const o of orders) {
    if (o.status !== "entregado") continue;
    const raw = deliveryActorForReport(o)?.trim();
    const key = raw ? raw.toLowerCase() : "__sin_nombre__";
    const display = raw || "—";
    const rev = orderKnownRevenueEuros(o);
    let row = map.get(key);
    if (!row) {
      row = { displayName: display, deliveries: 0, tables: new Set(), revenueEuros: 0 };
      map.set(key, row);
    } else if (row.displayName === "—" && display !== "—") {
      row.displayName = display;
    }
    row.deliveries += 1;
    row.tables.add(o.mesa);
    row.revenueEuros = Math.round((row.revenueEuros + rev) * 100) / 100;
  }

  return [...map.entries()]
    .map(([staffKey, v]) => ({
      staffKey,
      displayName: v.displayName,
      deliveries: v.deliveries,
      tables: [...v.tables].sort((a, b) => a - b),
      revenueEuros: v.revenueEuros,
    }))
    .sort((a, b) => b.revenueEuros - a.revenueEuros);
}
