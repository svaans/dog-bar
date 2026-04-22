import { getOrderStorageMode } from "@/lib/order-storage-mode";
import type { StaffMesaAssignment } from "@/lib/staff-mesa-types";
import * as jsonIo from "@/lib/staff-mesa-io-json";
import * as supabaseIo from "@/lib/staff-mesa-io-supabase";

/** Tras este tiempo sin “join” de nuevo, la asignación se ignora en listados. */
const STALE_MS = 5 * 60 * 1000;

function isFresh(a: StaffMesaAssignment, now: number): boolean {
  const t = new Date(a.updatedAt).getTime();
  return Number.isFinite(t) && now - t < STALE_MS;
}

export async function listStaffMesaAssignmentsFresh(): Promise<StaffMesaAssignment[]> {
  const mode = getOrderStorageMode();
  const now = Date.now();
  const rows =
    mode === "supabase"
      ? await supabaseIo.readAssignmentsSupabase()
      : jsonIo.readAssignmentsJson();
  return rows.filter((r) => isFresh(r, now));
}

export async function joinStaffMesa(mesa: number, staffName: string): Promise<void> {
  const trimmed = staffName.trim().slice(0, 80);
  if (!trimmed) throw new Error("Nombre vacío");
  const nowIso = new Date().toISOString();
  if (getOrderStorageMode() === "supabase") {
    // Preservar joinedAt si ya existía.
    const existing = (await supabaseIo.readAssignmentsSupabase()).find(
      (x) => x.mesa === mesa && x.staffName === trimmed,
    );
    const row: StaffMesaAssignment = {
      mesa,
      staffName: trimmed,
      joinedAt: existing?.joinedAt ?? nowIso,
      updatedAt: nowIso,
    };
    await supabaseIo.upsertAssignmentSupabase(row);
    return;
  }
  const all = jsonIo.readAssignmentsJson();
  const prev = all.find((x) => x.mesa === mesa && x.staffName === trimmed);
  const next = all.filter((x) => !(x.mesa === mesa && x.staffName === trimmed));
  next.push({
    mesa,
    staffName: trimmed,
    joinedAt: prev?.joinedAt ?? nowIso,
    updatedAt: nowIso,
  });
  jsonIo.writeAssignmentsJson(next);
}

export async function leaveStaffMesa(mesa: number, staffName: string): Promise<void> {
  const trimmed = staffName.trim().slice(0, 80);
  if (!trimmed) throw new Error("Nombre vacío");
  if (getOrderStorageMode() === "supabase") {
    await supabaseIo.deleteAssignmentSupabase(mesa, trimmed);
    return;
  }
  const all = jsonIo.readAssignmentsJson();
  jsonIo.writeAssignmentsJson(all.filter((x) => !(x.mesa === mesa && x.staffName === trimmed)));
}
