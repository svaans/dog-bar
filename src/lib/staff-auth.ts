export function staffKeyMatches(provided: string | null): boolean {
  const expected = process.env.STAFF_ORDER_KEY?.trim();
  const prod = process.env.NODE_ENV === "production";
  if (prod) {
    if (!expected) return false;
    return Boolean(provided && provided === expected);
  }
  if (!expected) return true;
  return Boolean(provided && provided === expected);
}
