import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;

/** Formato `v1$<salt b64url>$<hash b64url>`. */
export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(pin, salt, KEY_LEN);
  return `v1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
    const hash = scryptSync(pin, salt, KEY_LEN);
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}
