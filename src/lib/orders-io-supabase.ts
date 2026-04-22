import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Order } from "@/types/orders";

const TABLE = "dog_bar_orders";

function getUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    undefined
  );
}

function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

function getClient(): SupabaseClient {
  const url = getUrl();
  const key = getServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "El almacén en la nube no está bien configurado. Pide ayuda a quien gestiona la app.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readOrdersSupabase(): Promise<Order[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from(TABLE).select("payload");
  if (error) {
    throw new Error("No se pudieron cargar los pedidos. Reintenta o avisa al encargado.");
  }
  return (data ?? []).map((row) => row.payload as Order);
}

/** Solo pedidos que siguen en cola (excluye entregado y cancelado). Menos tráfico que leer toda la tabla. */
export async function readActiveOrdersSupabase(): Promise<Order[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .not("payload->>status", "in", '("entregado","cancelado")');
  if (error) {
    throw new Error("No se pudieron cargar los pedidos activos. Reintenta o avisa al encargado.");
  }
  return (data ?? []).map((row) => row.payload as Order);
}

export async function readOrderSupabase(id: string): Promise<Order | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error("No se pudo cargar ese pedido. Reintenta o avisa al encargado.");
  }
  if (!data?.payload) return null;
  return data.payload as Order;
}

export async function insertOrderSupabase(order: Order): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).insert({
    id: order.id,
    payload: order,
  });
  if (error) {
    throw new Error("No se pudo registrar el pedido. Reintenta o avisa al encargado.");
  }
}

export async function upsertOrderSupabase(order: Order): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).upsert(
    { id: order.id, payload: order },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error("No se pudo actualizar el pedido. Reintenta o avisa al encargado.");
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const UPSERT_CHUNK = 250;
const DELETE_CHUNK = 200;

export async function writeOrdersSupabase(orders: Order[]): Promise<void> {
  const supabase = getClient();
  const { data: rows, error: selErr } = await supabase.from(TABLE).select("id");
  if (selErr) {
    throw new Error("No se pudo preparar el guardado de pedidos. Reintenta o avisa al encargado.");
  }
  const existing = new Set((rows ?? []).map((r: { id: string }) => r.id));
  const nextIds = new Set(orders.map((o) => o.id));
  const toDelete = [...existing].filter((id) => !nextIds.has(id));

  for (const part of chunk(toDelete, DELETE_CHUNK)) {
    if (part.length === 0) continue;
    const { error: delErr } = await supabase.from(TABLE).delete().in("id", part);
    if (delErr) {
      throw new Error("No se pudieron actualizar los pedidos. Reintenta o avisa al encargado.");
    }
  }

  for (const part of chunk(orders, UPSERT_CHUNK)) {
    if (part.length === 0) continue;
    const batch = part.map((o) => ({ id: o.id, payload: o }));
    const { error: upErr } = await supabase.from(TABLE).upsert(batch, {
      onConflict: "id",
    });
    if (upErr) {
      throw new Error("No se pudieron guardar los pedidos. Reintenta o avisa al encargado.");
    }
  }
}
