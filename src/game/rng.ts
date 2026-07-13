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

/** Mutable convenience wrapper: pulls one float and writes the advanced state back. */
export class Rng {
  constructor(public state: number) {}
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  /** Weighted index by a parallel weights array (weights need not sum to 1). */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}
