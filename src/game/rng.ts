// Deterministic, seedable PRNG (mulberry32). Purely functional: the caller holds
// the uint32 state (persisted in the save) so any run is fully reproducible.

export function seedFrom(seed: number): number {
  return seed >>> 0;
}

/** Advance the generator once. Returns a float in [0,1) and the next state. */
export function nextRandom(state: number): { value: number; state: number } {
  let a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a >>> 0 };
}
