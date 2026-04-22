import type { Order, OrderLine } from "@/types/orders";

import { calendarDateKeyInZone, formatTimeHmInZone } from "@/lib/timezone";

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[;\r\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function lineTotalEuros(line: OrderLine): string {
  if (line.unitPriceEuros === null) return "";
  const t = line.unitPriceEuros * line.quantity;
  return t.toFixed(2).replace(".", ",");
}

/** CSV con separador `;` y BOM UTF-8 para abrir bien en Excel (ES). */
export function buildOrdersLinesCsv(orders: Order[], timeZone: string): string {
  const header = [
    "fecha",
    "hora",
    "mesa",
    "nombre_mesa_cliente",
    "ultimo_actor",
    "estado_pedido",
    "referencia_pedido",
    "nota_cliente",
    "producto",
    "cantidad",
    "precio_unitario_eur",
    "opciones",
    "importe_linea_eur",
  ];

  const rows: string[][] = [header];

  for (const o of orders) {
    const fecha = calendarDateKeyInZone(o.createdAt, timeZone);
    const hora = formatTimeHmInZone(o.createdAt, timeZone);
    for (const line of o.lines) {
      rows.push([
        fecha,
        hora,
        String(o.mesa),
        o.customerDisplayName ?? "",
        o.lastActorName ?? "",
        o.status,
        o.id,
        o.customerNote ?? "",
        line.name,
        String(line.quantity),
        line.unitPriceEuros === null ? "" : String(line.unitPriceEuros).replace(".", ","),
        line.optionsLabel ?? "",
        lineTotalEuros(line),
      ]);
    }
  }

  const body = rows
    .map((r) => r.map((c) => csvCell(c)).join(";"))
    .join("\r\n");

  return `\uFEFF${body}\r\n`;
}
