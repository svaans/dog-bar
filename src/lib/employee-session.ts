import { createHmac, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";

export const EMPLOYEE_SESSION_COOKIE = "meraki_employee_sess";

export type EmployeeSessionPayload = {
  /** Versión del token */
  v: 1;
  sub: string;
  n: number;
  name: string;
  /** exp en ms epoch */
  exp: number;
};

function getSessionSecret(): string {
  const a = process.env.STAFF_EMPLOYEE_SESSION_SECRET?.trim();
  if (a) return a;
  const b = process.env.STAFF_ORDER_KEY?.trim();
  if (b) return b;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta STAFF_EMPLOYEE_SESSION_SECRET o STAFF_ORDER_KEY para sesiones de empleado.");
  }
  return "dev-employee-session-insecure";
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signEmployeeSession(payload: EmployeeSessionPayload): string {
  const secret = getSessionSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signBody(body, secret);
  return `${body}.${sig}`;
}

export function verifyEmployeeSessionToken(token: string): EmployeeSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const secret = getSessionSecret();
  const expected = signBody(body, secret);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const p = parsed as Partial<EmployeeSessionPayload>;
  if (p.v !== 1 || typeof p.sub !== "string" || typeof p.name !== "string" || typeof p.exp !== "number") {
    return null;
  }
  const n = typeof p.n === "number" ? p.n : Number(p.n);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  if (Date.now() > p.exp) return null;
  return { v: 1, sub: p.sub, n, name: p.name.slice(0, 80), exp: p.exp };
}

const TWELVE_H_MS = 12 * 60 * 60 * 1000;

export function buildSessionPayload(emp: {
  id: string;
  employeeNumber: number;
  displayName: string;
}): EmployeeSessionPayload {
  return {
    v: 1,
    sub: emp.id,
    n: emp.employeeNumber,
    name: emp.displayName.trim().slice(0, 80),
    exp: Date.now() + TWELVE_H_MS,
  };
}

export async function getEmployeeSessionFromCookies(): Promise<EmployeeSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(EMPLOYEE_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifyEmployeeSessionToken(raw);
}
