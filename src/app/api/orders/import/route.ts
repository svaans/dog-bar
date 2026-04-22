import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { replaceAllOrders } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import type { Order, OrderStatus, StatusLogEntry } from "@/types/orders";

export const runtime = "nodejs";

const MAX_ORDERS_IMPORT = 5000;

const STATUSES: OrderStatus[] = [
  "nuevo",
  "preparando",
  "listo",
  "entregado",
  "cancelado",
];

function isStatusLogEntry(x: unknown): x is StatusLogEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  if (typeof e.at !== "string" || typeof e.status !== "string") return false;
  if (!STATUSES.includes(e.status as OrderStatus)) return false;
  if (e.actor !== undefined && typeof e.actor !== "string") return false;
  return true;
}

function isOrder(x: unknown): x is Order {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.mesa !== "number") return false;
  if (typeof o.createdAt !== "string" || typeof o.updatedAt !== "string") return false;
  if (typeof o.status !== "string" || !STATUSES.includes(o.status as OrderStatus)) {
    return false;
  }
  if (o.customerNote !== undefined && typeof o.customerNote !== "string") return false;
  if (o.customerDisplayName !== undefined && typeof o.customerDisplayName !== "string") {
    return false;
  }
  if (o.lastActorName !== undefined && typeof o.lastActorName !== "string") return false;
  if (o.statusLog !== undefined) {
    if (!Array.isArray(o.statusLog)) return false;
    for (const entry of o.statusLog) {
      if (!isStatusLogEntry(entry)) return false;
    }
  }
  if (!Array.isArray(o.lines)) return false;
  for (const line of o.lines) {
    if (!line || typeof line !== "object") return false;
    const l = line as Record<string, unknown>;
    if (typeof l.menuItemId !== "string" || typeof l.name !== "string") return false;
    if (typeof l.quantity !== "number") return false;
    if (l.unitPriceEuros !== null && typeof l.unitPriceEuros !== "number") return false;
    if (l.optionsLabel !== undefined && typeof l.optionsLabel !== "string") return false;
  }
  return true;
}

export async function POST(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Se espera un array de pedidos" }, { status: 400 });
  }
  if (body.length > MAX_ORDERS_IMPORT) {
    return NextResponse.json(
      { error: "El archivo contiene demasiados pedidos. Divide la importación o pide ayuda." },
      { status: 400 },
    );
  }
  const orders: Order[] = [];
  for (const item of body) {
    if (!isOrder(item)) {
      return NextResponse.json({ error: "Uno o más pedidos no tienen formato válido" }, { status: 400 });
    }
    orders.push(item as Order);
  }
  try {
    await replaceAllOrders(orders);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  return NextResponse.json({ ok: true, count: orders.length });
}
