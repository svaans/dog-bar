/** Zona horaria del local (para “hoy” en historial y export). */
export function getRestaurantTimeZone(): string {
  return process.env.RESTAURANT_TZ?.trim() || "Europe/Madrid";
}

/** Fecha calendario YYYY-MM-DD de un instante ISO en la zona indicada. */
export function calendarDateKeyInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Fecha de hoy (YYYY-MM-DD) en la zona indicada. */
export function todayCalendarDateKey(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatTimeHmInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
