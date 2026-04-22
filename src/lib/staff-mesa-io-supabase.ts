import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { StaffMesaAssignment } from "@/lib/staff-mesa-types";

const TABLE = "dog_bar_staff_mesa";

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

export async function readAssignmentsSupabase(): Promise<StaffMesaAssignment[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("mesa,staff_name,updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error("No se pudieron leer las asignaciones de mesa.");
  }
  return (data ?? []).map((r) => ({
    mesa: Number(r.mesa),
    staffName: String(r.staff_name),
    updatedAt: String(r.updated_at),
  }));
}

export async function upsertAssignmentSupabase(row: StaffMesaAssignment): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      mesa: row.mesa,
      staff_name: row.staffName,
      updated_at: row.updatedAt,
    },
    { onConflict: "mesa,staff_name" },
  );
  if (error) throw new Error("No se pudo registrar la mesa atendida.");
}

export async function deleteAssignmentSupabase(mesa: number, staffName: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).delete().eq("mesa", mesa).eq("staff_name", staffName);
  if (error) throw new Error("No se pudo quitar la asignación de mesa.");
}
