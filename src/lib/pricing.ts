import type { MenuItem, ModifierSelections } from "@/types/menu";

export type { ModifierSelections };

export function formatSelectionsLabel(
  item: MenuItem,
  selections: ModifierSelections,
): string {
  if (!item.modifiers?.length) return "";
  const parts: string[] = [];
  for (const step of item.modifiers) {
    const optId = selections[step.id];
    const opt = step.options.find((o) => o.id === optId);
    if (opt) parts.push(opt.label);
  }
  return parts.join(" · ");
}

export function resolveUnitPrice(
  item: MenuItem,
  selections: ModifierSelections,
): number | null {
  let price: number | null = item.priceEuros;
  for (const step of item.modifiers ?? []) {
    const optId = selections[step.id];
    const opt = step.options.find((o) => o.id === optId);
    if (opt && typeof opt.priceEuros === "number") {
      price = opt.priceEuros;
    }
  }
  return price;
}

export function modifiersComplete(
  item: MenuItem,
  selections: ModifierSelections,
): boolean {
  if (!item.modifiers?.length) return true;
  return item.modifiers.every((s) => Boolean(selections[s.id]));
}
