import { describe, it, expect } from 'vitest';
import { createInitialSave } from './save';
import { stepSim } from './combat';
import { pickRelic, resolveEvent, rebirth } from './run';
import { buyNode } from './meta';

describe('run setup', () => {
  it('starts a fresh run at stage 1 with full hp and warrior unlocked', () => {
    const s = createInitialSave(0);
    expect(s.run.stage).toBe(1);
    expect(s.run.phase).toBe('fighting');
    expect(s.run.hero.hp).toBe(s.run.stats.maxHp);
    expect(s.meta.unlockedClasses).toContain('warrior');
  });
});

describe('stepSim', () => {
  it('deals damage, grants gold, and reaches a relic choice on stage clear', () => {
    const s = createInitialSave(0);
    let ticks = 0;
    while (s.run.phase === 'fighting' && ticks < 20000) {
      stepSim(s);
      ticks++;
    }
    expect(s.run.kills).toBeGreaterThan(0);
    expect(s.run.gold).toBeGreaterThan(0);
    expect(['relic', 'event', 'dead']).toContain(s.run.phase);
  });

  it('pauses the sim while awaiting a relic pick, then resumes', () => {
    const s = createInitialSave(0);
    let ticks = 0;
    while (s.run.phase === 'fighting' && ticks < 20000) {
      stepSim(s);
      ticks++;
    }
    if (s.run.phase === 'relic') {
      const before = s.run.relics.length;
      // sim does nothing while choosing
      const gold = s.run.gold;
      stepSim(s);
      expect(s.run.gold).toBe(gold);
      pickRelic(s, 0);
      expect(s.run.relics.length).toBe(before + 1);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = createInitialSave(0, 42);
    const b = createInitialSave(0, 42);
    for (let i = 0; i < 4000; i++) {
      stepSim(a);
      stepSim(b);
    }
    expect(a.run.gold).toBe(b.run.gold);
    expect(a.run.stage).toBe(b.run.stage);
    expect(a.rngState).toBe(b.rngState);
  });
});

describe('crit tiers + lifesteal', () => {
  it('crit chance over 100% always crits and the overflow rolls double crits', () => {
    const s = createInitialSave(0, 7);
    let crit = 0;
    let dbl = 0;
    for (let i = 0; i < 3000 && crit + dbl < 200; i++) {
      if (s.run.phase === 'relic') { pickRelic(s, 0); continue; }
      if (s.run.phase === 'event') { resolveEvent(s, 0); continue; }
      if (s.run.phase === 'dead') break;
      s.run.stats.critChance = 1.4; // guaranteed crit + 40% double
      s.run.stats.attack = 9999; // one-shot enemies → lots of hits fast
      const e = stepSim(s);
      if (e.hit) {
        expect(e.hit.crit).toBe(true); // ≥100% ⇒ every hit crits
        if (e.hit.double) dbl++;
        else crit++;
      }
    }
    expect(crit).toBeGreaterThan(0);
    expect(dbl).toBeGreaterThan(0); // the overflow produced double crits
  });

  it('stays deterministic when crit chance exceeds 100%', () => {
    const a = createInitialSave(0, 99);
    const b = createInitialSave(0, 99);
    for (let i = 0; i < 1500; i++) {
      a.run.stats.critChance = 1.3;
      b.run.stats.critChance = 1.3;
      stepSim(a);
      stepSim(b);
    }
    expect(a.rngState).toBe(b.rngState);
    expect(a.run.gold).toBe(b.run.gold);
    expect(a.run.stage).toBe(b.run.stage);
  });

  it('lifesteal reports the actual clamped heal amount on the hit', () => {
    const s = createInitialSave(0, 3);
    let healed: { heal: number } | undefined;
    for (let i = 0; i < 60 && !healed; i++) {
      if (s.run.phase !== 'fighting') break;
      s.run.stats.lifesteal = 0.5;
      s.run.stats.attack = 9999; // one-shot → no retaliation, hero survives
      s.run.hero.hp = s.run.stats.maxHp / 2; // leave headroom to heal into
      const before = s.run.hero.hp;
      const e = stepSim(s);
      if (e.hit && e.hit.heal > 0) {
        healed = e.hit;
        expect(e.hit.heal).toBe(s.run.hero.hp - before); // equals real hp gained
        expect(s.run.hero.hp).toBeLessThanOrEqual(s.run.stats.maxHp); // clamped
      }
    }
    expect(healed).toBeDefined();
  });
});

describe('meta + rebirth', () => {
  it('rebirth banks essence and resets the run', () => {
    const s = createInitialSave(0);
    // advance a bit to reach a higher stage
    let ticks = 0;
    while (s.run.stage < 3 && ticks < 40000) {
      if (s.run.phase === 'relic') pickRelic(s, 0);
      else if (s.run.phase === 'event') break;
      else if (s.run.phase === 'dead') break;
      else stepSim(s);
      ticks++;
    }
    const beforeEssence = s.meta.essence;
    rebirth(s);
    expect(s.meta.essence).toBeGreaterThanOrEqual(beforeEssence);
    expect(s.run.stage).toBeGreaterThanOrEqual(1);
    expect(s.run.relics.length).toBe(0);
  });

  it('buys a meta node when affordable', () => {
    const s = createInitialSave(0);
    s.meta.essence = 100;
    const ok = buyNode(s, 'might');
    expect(ok).toBe(true);
    expect(s.meta.nodes['might']).toBe(1);
    expect(s.meta.essence).toBeLessThan(100);
  });
});
