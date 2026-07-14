import { describe, it, expect } from 'vitest';
import { createInitialSave, deserialize, serialize } from './save';
import { pickRelic, recompute } from './run';
import { RELICS } from './content/relics';
import { stepSim } from './combat';
import { allocateSkill, respecSkills, skillsAllocated } from './meta';
import { rollRarity } from './progression';
import { RELIC_EVERY_STAGES, SKILL_POINTS } from './constants';
import { RARITIES } from './types';
import { Rng } from './rng';

/** Run the sim until the run leaves 'fighting' (box/event) or hits the cap. */
function fightUntilPause(save: ReturnType<typeof createInitialSave>, maxTicks = 500_000) {
  let t = 0;
  while (save.run.phase === 'fighting' && t < maxTicks) {
    stepSim(save);
    t++;
  }
  return t;
}

describe('mystery box cadence', () => {
  it('offers a single relic only on every Nth cleared stage', () => {
    const save = createInitialSave(1);
    // brute-force the hero so stages actually clear
    save.run.stats.attack = 1e9;
    save.run.stats.maxHp = 1e9;
    save.run.hero.hp = 1e9;
    for (let guard = 0; guard < 20 && save.run.phase !== 'relic'; guard++) {
      fightUntilPause(save);
      if (save.run.phase === 'event') {
        save.run.eventId = null;
        save.run.phase = 'fighting';
      }
      // stats are recomputed on stage clear — re-apply the brute force
      save.run.stats.attack = 1e9;
      save.run.hero.hp = save.run.stats.maxHp;
    }
    expect(save.run.phase).toBe('relic');
    expect(save.run.offer).toHaveLength(1);
    // the box drops when the stage just cleared is a multiple of the cadence
    expect((save.run.stage - 1) % RELIC_EVERY_STAGES).toBe(0);
  });
});

describe('rollRarity luck', () => {
  it('extra rolls never lower and statistically raise the rarity', () => {
    const base = new Rng(123);
    const lucky = new Rng(123);
    let baseScore = 0;
    let luckyScore = 0;
    for (let i = 0; i < 3000; i++) {
      baseScore += RARITIES.indexOf(rollRarity(base));
      luckyScore += RARITIES.indexOf(rollRarity(lucky, 2));
    }
    expect(luckyScore).toBeGreaterThan(baseScore);
  });
});

describe('skill tree prereqs', () => {
  it('blocks deep nodes until the chain is allocated, and refunds tips-first', () => {
    const save = createInitialSave(1);
    expect(allocateSkill(save, 'sk_exec')).toBe(false); // needs sk_power
    expect(allocateSkill(save, 'sk_edge')).toBe(true);
    expect(allocateSkill(save, 'sk_power')).toBe(true);
    expect(allocateSkill(save, 'sk_exec')).toBe(true);
    expect(allocateSkill(save, 'sk_power')).toBe(false); // child allocated
    expect(allocateSkill(save, 'sk_exec')).toBe(true); // refund the tip
    expect(allocateSkill(save, 'sk_power')).toBe(true); // now refundable
    respecSkills(save);
    expect(skillsAllocated(save)).toBe(0);
  });

  it('drops orphan skills from legacy saves on load', () => {
    const save = createInitialSave(1);
    save.meta.skills = { sk_exec: 1, sk_ruin: 1, sk_edge: 1 }; // deep nodes without chains
    const loaded = deserialize(serialize(save), 2);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.skills).toEqual({ sk_edge: 1 }); // only the rooted node survives
    expect(skillsAllocated(loaded!)).toBeLessThanOrEqual(SKILL_POINTS);
  });
});

describe('legacy multi-relic offers', () => {
  it('collapses a pending 3-choice offer to its single best relic', () => {
    const save = createInitialSave(1);
    save.run.phase = 'relic';
    save.run.offer = [
      { id: 'rusty_blade', rarity: 'common' },
      { id: 'quickdraw', rarity: 'legendary' },
      { id: 'lucky_coin', rarity: 'rare' },
    ];
    const loaded = deserialize(serialize(save), 2);
    expect(loaded).not.toBeNull();
    expect(loaded!.run.offer).toHaveLength(1);
    expect(loaded!.run.offer![0]).toMatchObject({ id: 'quickdraw', rarity: 'legendary' });
  });
});

describe('pity + codex', () => {
  it('guarantees epic+ on the Nth box and resets the counter', () => {
    const save = createInitialSave(1);
    save.meta.pity = 9; // next box is the guaranteed one
    save.run.stats.attack = 1e9;
    save.run.stats.maxHp = 1e9;
    save.run.hero.hp = 1e9;
    for (let guard = 0; guard < 20 && save.run.phase !== 'relic'; guard++) {
      let t = 0;
      while (save.run.phase === 'fighting' && t++ < 500_000) stepSim(save);
      if (save.run.phase === 'event') {
        save.run.eventId = null;
        save.run.phase = 'fighting';
      }
      save.run.stats.attack = 1e9;
      save.run.hero.hp = save.run.stats.maxHp;
    }
    expect(save.run.phase).toBe('relic');
    const rarity = save.run.offer![0].rarity;
    expect(['epic', 'legendary']).toContain(rarity);
    expect(save.meta.pity).toBe(0);
  });

  it('records obtained relics into the permanent codex', () => {
    const save = createInitialSave(1);
    save.run.phase = 'relic';
    save.run.offer = [{ id: 'quickdraw', rarity: 'rare' }];
    pickRelic(save, 0);
    expect(save.meta.codex['quickdraw']).toBe(RARITIES.indexOf('rare'));
    // a better copy upgrades the entry; a worse one doesn't downgrade it
    save.run.phase = 'relic';
    save.run.offer = [{ id: 'quickdraw', rarity: 'legendary' }];
    pickRelic(save, 0);
    expect(save.meta.codex['quickdraw']).toBe(RARITIES.indexOf('legendary'));
  });

  it('completed archetype sets add their permanent bonus to stats', () => {
    const save = createInitialSave(1);
    const before = save.run.stats.goldMult;
    for (const r of RELICS.filter((x) => x.archetype === 'gold')) save.meta.codex[r.id] = 0;
    recompute(save);
    expect(save.run.stats.goldMult).toBeCloseTo(before + 0.12, 5);
  });
});
