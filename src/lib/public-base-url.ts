import { headers } from "next/headers";

/**
 * Base URL solo desde env (para `metadataBase` en layout, sin `headers()`).
 */
export function publicMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const normalized = raw.replace(/\/$/, "");
      return new URL(`${normalized}/`);
    } catch {
      /* seguir */
    }
  }
  return new URL("http://localhost:3000/");
}

/**
 * URL pública de la app (para QRs). Prioriza NEXT_PUBLIC_APP_URL si está definida.
 */
export async function resolvePublicBaseUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return "http://localhost:3000";
  }

  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${proto}://${host}`;
}
