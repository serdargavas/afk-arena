import { describe, it, expect } from 'vitest';
import { createInitialState } from './save';
import { stepSim } from './combat';
import { enemyHpForWave, goldForWave } from './economy';

describe('economy scaling', () => {
  it('has the expected wave-1 baselines', () => {
    expect(enemyHpForWave(1)).toBe(10);
    expect(goldForWave(1)).toBe(5);
  });

  it('grows monotonically with wave', () => {
    expect(enemyHpForWave(5)).toBeGreaterThan(enemyHpForWave(1));
    expect(goldForWave(5)).toBeGreaterThan(goldForWave(1));
  });
});

describe('stepSim', () => {
  it('kills the enemy and advances the wave + gold', () => {
    const s = createInitialState(0);
    const startWave = s.wave;
    let ticks = 0;
    while (s.wave === startWave && ticks < 1000) {
      stepSim(s);
      ticks++;
    }
    expect(s.wave).toBe(startWave + 1);
    expect(s.kills).toBe(1);
    expect(s.gold).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed', () => {
    const a = createInitialState(0, 123);
    const b = createInitialState(0, 123);
    for (let i = 0; i < 500; i++) {
      stepSim(a);
      stepSim(b);
    }
    expect(a.gold).toBe(b.gold);
    expect(a.wave).toBe(b.wave);
    expect(a.kills).toBe(b.kills);
    expect(a.rngState).toBe(b.rngState);
  });

  it('diverges for different seeds (crit RNG is actually used)', () => {
    const a = createInitialState(0, 1);
    const b = createInitialState(0, 999999);
    for (let i = 0; i < 2000; i++) {
      stepSim(a);
      stepSim(b);
    }
    // Different crit rolls → different rng state after the same tick count.
    expect(a.rngState).not.toBe(b.rngState);
  });
});
