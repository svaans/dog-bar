import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 35;

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** 429 si se supera el límite; si no, null. */
export function orderPostRateLimitResponse(req: Request): NextResponse | null {
  const ip = clientIp(req);
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { count: 0, windowStart: now };
  }
  b.count += 1;
  buckets.set(ip, b);
  if (b.count > MAX_PER_WINDOW) {
    return NextResponse.json(
      { error: "Demasiados pedidos desde esta conexión. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }
  if (buckets.size > 20_000) {
    buckets.clear();
  }
  return null;
}
