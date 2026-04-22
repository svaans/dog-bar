import { getStaffProvidedKey } from "@/lib/staff-request";

export function adminKeyMatches(provided: string | null): boolean {
  const expected = process.env.STAFF_ADMIN_KEY?.trim();
  const prod = process.env.NODE_ENV === "production";
  if (prod) {
    if (!expected) return false;
    return Boolean(provided && provided === expected);
  }
  if (!expected) return true;
  return Boolean(provided && provided === expected);
}

/** En producción solo se acepta por cabecera. */
export function getAdminProvidedKey(req: Request): string | null {
  const header = req.headers.get("x-admin-key")?.trim();
  if (header) return header;
  // fallback a x-staff-key en dev para facilitar pruebas locales
  return process.env.NODE_ENV === "production" ? null : getStaffProvidedKey(req);
}

