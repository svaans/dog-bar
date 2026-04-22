import { calendarDateKeyInZone } from "@/lib/timezone";
import type { Order, OrderStatus, StatusLogEntry } from "@/types/orders";

import { getOrderStorageMode } from "@/lib/order-storage-mode";
import * as jsonIo from "@/lib/orders-io-json";
import * as sqliteIo from "@/lib/orders-io-sqlite";
import * as supabaseIo from "@/lib/orders-io-supabase";

async function readAll(): Promise<Order[]> {
  const mode = getOrderStorageMode();
  if (mode === "supabase") {
    return supabaseIo.readOrdersSupabase();
  }
  if (mode === "sqlite") {
    return sqliteIo.readOrdersSqlite();
  }
  return jsonIo.readOrdersJson();
}

async function writeAll(orders: Order[]): Promise<void> {
  const mode = getOrderStorageMode();
  if (mode === "supabase") {
    await supabaseIo.writeOrdersSupabase(orders);
  } else if (mode === "sqlite") {
    sqliteIo.writeOrdersSqlite(orders);
  } else {
    jsonIo.writeOrdersJson(orders);
  }
}

/** Todos los pedidos tal cual en almacén (backup / import). */
export async function readAllOrdersSnapshot(): Promise<Order[]> {
  return readAll();
}

export async function listOrders(includeDelivered = false): Promise<Order[]> {
  if (getOrderStorageMode() === "supabase" && !includeDelivered) {
    const rows = await supabaseIo.readActiveOrdersSupabase();
    return rows.sort(sortByCreatedDesc);
  }
  const all = await readAll();
  if (includeDelivered) return all.sort(sortByCreatedDesc);
  return all
    .filter((o) => o.status !== "entregado" && o.status !== "cancelado")
    .sort(sortByCreatedDesc);
}

export async function listOrdersForCalendarDay(
  dayYmd: string,
  timeZone: string,
): Promise<Order[]> {
  const all = await readAll();
  return all
    .filter((o) => calendarDateKeyInZone(o.createdAt, timeZone) === dayYmd)
    .sort(sortByCreatedDesc);
}

function sortByCreatedDesc(a: Order, b: Order) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export async function createOrder(order: Order): Promise<void> {
  if (getOrderStorageMode() === "supabase") {
    await supabaseIo.insertOrderSupabase(order);
    return;
  }
  const all = await readAll();
  all.push(order);
  await writeAll(all);
}

const MAX_LOG = 40;

export type UpdateOrderStatusResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not_found" | "conflict" };

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  options?: { actorName?: string; ifUpdatedAt?: string },
): Promise<UpdateOrderStatusResult> {
  const mode = getOrderStorageMode();

  if (mode === "supabase") {
    const prev = await supabaseIo.readOrderSupabase(id);
    if (!prev) return { ok: false, reason: "not_found" };
    if (
      typeof options?.ifUpdatedAt === "string" &&
      options.ifUpdatedAt.length > 0 &&
      options.ifUpdatedAt !== prev.updatedAt
    ) {
      return { ok: false, reason: "conflict" };
    }
    const now = new Date().toISOString();
    const entry: StatusLogEntry = {
      at: now,
      status,
      actor: options?.actorName?.trim() || undefined,
    };
    const log = [...(prev.statusLog ?? []), entry].slice(-MAX_LOG);
    const next: Order = {
      ...prev,
      status,
      updatedAt: now,
      statusLog: log,
      lastActorName: entry.actor ?? prev.lastActorName,
    };
    await supabaseIo.upsertOrderSupabase(next);
    return { ok: true, order: next };
  }

  const all = await readAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return { ok: false, reason: "not_found" };
  const prev = all[idx];
  if (
    typeof options?.ifUpdatedAt === "string" &&
    options.ifUpdatedAt.length > 0 &&
    options.ifUpdatedAt !== prev.updatedAt
  ) {
    return { ok: false, reason: "conflict" };
  }
  const now = new Date().toISOString();
  const entry: StatusLogEntry = {
    at: now,
    status,
    actor: options?.actorName?.trim() || undefined,
  };
  const log = [...(prev.statusLog ?? []), entry].slice(-MAX_LOG);
  const next: Order = {
    ...prev,
    status,
    updatedAt: now,
    statusLog: log,
    lastActorName: entry.actor ?? prev.lastActorName,
  };
  all[idx] = next;
  await writeAll(all);
  return { ok: true, order: next };
}

export async function replaceAllOrders(orders: Order[]): Promise<void> {
  await writeAll(orders);
}

export async function getOrder(id: string): Promise<Order | null> {
  if (getOrderStorageMode() === "supabase") {
    return supabaseIo.readOrderSupabase(id);
  }
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}
