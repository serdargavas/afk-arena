const UNITS = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

/** Compact number formatting for the HUD (1234 → "1.23k"). */
export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return Math.floor(n).toString();
  let v = n;
  let u = 0;
  while (v >= 1000 && u < UNITS.length - 1) {
    v /= 1000;
    u++;
  }
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  return v.toFixed(digits) + UNITS[u];
}
