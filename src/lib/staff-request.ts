/**
 * Clave enviada por el personal. En producción solo se acepta por cabecera
 * (evita filtrar la clave en URL, historial y logs).
 */
export function getStaffProvidedKey(req: Request): string | null {
  const header = req.headers.get("x-staff-key")?.trim();
  if (header) return header;
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const url = new URL(req.url);
  return url.searchParams.get("key")?.trim() || null;
}
