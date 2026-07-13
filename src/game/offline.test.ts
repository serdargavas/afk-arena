import { describe, it, expect } from 'vitest';
import { createInitialSave } from './save';
import { serialize, deserialize } from './save';
import { applyOffline } from './offline';
import { MAX_OFFLINE_SECONDS } from './constants';

describe('applyOffline', () => {
  it('progresses the run (gold, kills, stages, auto-picked relics)', () => {
    const s = createInitialSave(0);
    const r = applyOffline(s, 300);
    expect(r.kills).toBeGreaterThan(0);
    expect(r.goldGained).toBeGreaterThan(0);
    expect(r.stagesCleared).toBeGreaterThanOrEqual(1);
    expect(r.relicsGained).toBeGreaterThanOrEqual(1);
  });

  it('does nothing for zero elapsed', () => {
    const s = createInitialSave(0);
    const r = applyOffline(s, 0);
    expect(r.goldGained).toBe(0);
    expect(r.kills).toBe(0);
  });

  it('caps very long absences', () => {
    const s = createInitialSave(0);
    const r = applyOffline(s, MAX_OFFLINE_SECONDS * 5);
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(MAX_OFFLINE_SECONDS);
  });

  it('is deterministic', () => {
    const a = createInitialSave(0);
    const b = createInitialSave(0);
    const ra = applyOffline(a, 1800);
    const rb = applyOffline(b, 1800);
    expect(ra).toEqual(rb);
    expect(a.run.gold).toBe(b.run.gold);
    expect(a.run.stage).toBe(b.run.stage);
  });
});

describe('save round-trip + hardening', () => {
  it('serializes and deserializes an advanced save intact', () => {
    const s = createInitialSave(0);
    applyOffline(s, 600);
    const round = deserialize(serialize(s), 0);
    expect(round).not.toBeNull();
    expect(round!.run.stage).toBe(s.run.stage);
    expect(round!.meta.essence).toBe(s.meta.essence);
  });

  it('rejects a wrong-version save (fresh fallback)', () => {
    expect(deserialize('{"version":1}', 0)).toBeNull();
    expect(deserialize('not json', 0)).toBeNull();
  });

  it('cannot be soft-locked or hung by a tampered hero (stats come from class base)', () => {
    const s = createInitialSave(0);
    // tamper: absurd hero fields that used to hang/soft-lock the v1 sim
    (s.run.hero as unknown as Record<string, unknown>).attackSpeed = -1;
    (s.run.hero as unknown as Record<string, unknown>).attack = -5;
    const round = deserialize(serialize(s), 0)!;
    // derived stats are rebuilt from the class base → always positive
    expect(round.run.stats.attack).toBeGreaterThan(0);
    expect(round.run.stats.attackSpeed).toBeGreaterThan(0);
  });
});
