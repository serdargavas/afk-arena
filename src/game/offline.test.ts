import { describe, it, expect } from 'vitest';
import { createInitialState } from './save';
import { applyOffline } from './offline';
import { MAX_OFFLINE_SECONDS } from './constants';

describe('applyOffline', () => {
  it('awards gold and clears waves over elapsed time', () => {
    const s = createInitialState(0);
    const r = applyOffline(s, 60);
    expect(r.goldGained).toBeGreaterThan(0);
    expect(r.kills).toBeGreaterThan(0);
    expect(s.gold).toBe(r.goldGained);
    expect(s.wave).toBe(1 + r.wavesCleared);
  });

  it('does nothing for zero elapsed', () => {
    const s = createInitialState(0);
    const r = applyOffline(s, 0);
    expect(r.goldGained).toBe(0);
    expect(r.kills).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.wave).toBe(1);
  });

  it('caps very long absences', () => {
    const s = createInitialState(0);
    const r = applyOffline(s, MAX_OFFLINE_SECONDS * 10);
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(MAX_OFFLINE_SECONDS);
  });

  it('is deterministic', () => {
    const a = createInitialState(0);
    const b = createInitialState(0);
    const ra = applyOffline(a, 3600);
    const rb = applyOffline(b, 3600);
    expect(ra).toEqual(rb);
    expect(a.gold).toBe(b.gold);
    expect(a.wave).toBe(b.wave);
  });
});
