export function getMesaCount(): number {
  const raw = process.env.MESA_COUNT?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n)) return Math.min(99, Math.max(1, n));
  return 20;
}

