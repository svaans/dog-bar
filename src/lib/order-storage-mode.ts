export type OrderStorageMode = "json" | "sqlite" | "supabase";

export function getOrderStorageMode(): OrderStorageMode {
  const raw = process.env.ORDER_STORAGE?.trim().toLowerCase();
  if (raw === "sqlite") return "sqlite";
  if (raw === "supabase") return "supabase";
  return "json";
}
