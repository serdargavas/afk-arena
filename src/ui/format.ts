const UNITS = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];

/** Compact number formatting for the HUD (1234 → "1.23k"). */
export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  let v = Math.abs(n);
  if (v < 1000) return (neg ? '-' : '') + Math.floor(v).toString();
  let u = 0;
  while (v >= 1000 && u < UNITS.length - 1) {
    v /= 1000;
    u++;
  }
  let digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  let str = v.toFixed(digits);
  // Re-normalize if rounding pushed the value to 1000 (fixes "1000k" → "1.00M").
  if (parseFloat(str) >= 1000 && u < UNITS.length - 1) {
    v /= 1000;
    u++;
    str = v.toFixed(2);
  }
  return (neg ? '-' : '') + str + UNITS[u];
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}
