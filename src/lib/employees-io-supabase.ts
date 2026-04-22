import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { EmployeeRecord } from "@/lib/employee-types";

const TABLE = "dog_bar_employees";

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

export async function readEmployeesSupabase(): Promise<EmployeeRecord[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,employee_number,display_name,pin_hash,active,created_at")
    .order("employee_number", { ascending: true });
  if (error) throw new Error("No se pudieron leer los empleados.");
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    employeeNumber: Number((r as { employee_number: number }).employee_number),
    displayName: String((r as { display_name: string }).display_name),
    pinHash: String((r as { pin_hash: string }).pin_hash),
    active: Boolean((r as { active: boolean }).active),
    createdAt: String((r as { created_at: string }).created_at),
  }));
}

export async function insertEmployeeSupabase(row: EmployeeRecord): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).insert({
    id: row.id,
    employee_number: row.employeeNumber,
    display_name: row.displayName,
    pin_hash: row.pinHash,
    active: row.active,
    created_at: row.createdAt,
  });
  if (error) throw new Error("No se pudo crear el empleado (¿número duplicado?).");
}

export async function setEmployeeActiveSupabase(id: string, active: boolean): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).update({ active }).eq("id", id);
  if (error) throw new Error("No se pudo actualizar el empleado.");
}
