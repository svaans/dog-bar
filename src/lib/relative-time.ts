/** Minutos transcurridos desde un instante ISO. */
export function minutesSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.floor((now - t) / 60_000));
}

import type { UiLang } from "@/lib/ui-i18n";

/** Texto tipo "hace 12 min" / "12 min ago". */
export function formatHaceMinutos(iso: string, now = Date.now(), lang: UiLang = "es"): string {
  const m = minutesSince(iso, now);
  if (lang === "en") {
    if (m <= 0) return "just now";
    if (m === 1) return "1 min ago";
    return `${m} min ago`;
  }
  if (m <= 0) return "ahora";
  if (m === 1) return "hace 1 min";
  return `hace ${m} min`;
}

/**
 * Acento visual por antigüedad en cola (solo activos con sentido operativo).
 */
export function orderAgeAccentClass(
  status: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado",
  createdAt: string,
  now = Date.now(),
): string {
  const m = minutesSince(createdAt, now);
  if (status === "nuevo" && m >= 12) {
    return "shadow-[inset_0_0_0_2px_rgba(185,28,28,0.45)]";
  }
  if (status === "preparando" && m >= 25) {
    return "shadow-[inset_0_0_0_2px_rgba(180,83,9,0.5)]";
  }
  return "";
}
