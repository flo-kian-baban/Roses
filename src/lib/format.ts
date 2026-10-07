// Formatting helpers safe for any bundle (no database imports).
export function price(n: number | string | null | undefined): string | null {
  if (n == null || n === '') return null;
  return `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
}
