import { describe, it, expect } from 'vitest';
import { createInitialSave, serialize, deserialize } from './save';
import { rollItem } from './content/items';
import { die } from './run';
import { Rng } from './rng';
import { SLOT_IDS } from './types';
import type { ItemInstance, RelicMods } from './types';
import { MAX_INVENTORY, SKILL_POINTS } from './constants';
import { SKILL_NODES, SKILL_BY_ID } from './content/skills';

const NOW = 1_000_000;

describe('save migration (sanitize)', () => {
  it('loads an old v2 save missing the new meta fields with safe defaults', () => {
    const raw = JSON.parse(serialize(createInitialSave(NOW)));
    delete raw.meta.skills;
    delete raw.meta.inventory;
    delete raw.meta.equipped;
    delete raw.meta.itemSeq;
    const loaded = deserialize(JSON.stringify(raw), NOW);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.skills).toEqual({});
    expect(loaded!.meta.inventory).toEqual([]);
    expect(loaded!.meta.equipped).toEqual({ weapon: null, armor: null, ring: null, amulet: null });
    expect(loaded!.meta.itemSeq).toBe(1);
  });

  it('drops duplicate uids, invalid/wrong-slot equipped refs, and keeps itemSeq ahead of every uid', () => {
    const raw = JSON.parse(serialize(createInitialSave(NOW)));
    raw.meta.inventory = [
      { uid: 5, slot: 'weapon', rarity: 'rare', mods: { attackPct: 0.1 } },
      { uid: 5, slot: 'armor', rarity: 'epic', mods: { maxHpPct: 0.2 } }, // dup uid → dropped
      { uid: 9, slot: 'ring', rarity: 'common', mods: {} },
    ];
    raw.meta.equipped = { weapon: 9, armor: null, ring: 9, amulet: 7 };
    raw.meta.itemSeq = 2;
    const loaded = deserialize(JSON.stringify(raw), NOW)!;
    expect(loaded.meta.inventory.map((i) => i.uid).sort()).toEqual([5, 9]);
    expect(loaded.meta.equipped.weapon).toBeNull(); // uid 9 is a ring, not a weapon
    expect(loaded.meta.equipped.ring).toBe(9);
    expect(loaded.meta.equipped.amulet).toBeNull(); // uid 7 not owned
    expect(loaded.meta.itemSeq).toBeGreaterThan(9);
  });

  it('caps allocated skills at the point budget', () => {
    const raw = JSON.parse(serialize(createInitialSave(NOW)));
    raw.meta.skills = {};
    for (const node of SKILL_NODES) raw.meta.skills[node.id] = 1; // all 30 real nodes
    raw.meta.skills['bogus_id'] = 1; // invalid id → dropped
    const loaded = deserialize(JSON.stringify(raw), NOW)!;
    const kept = Object.keys(loaded.meta.skills);
    expect(kept.length).toBe(SKILL_POINTS);
    for (const id of kept) expect(SKILL_BY_ID[id]).toBeDefined();
  });
});

describe('rollItem', () => {
  it('always produces a valid slot, 1–3 finite affixes', () => {
    const rng = new Rng(12345);
    for (let i = 0; i < 400; i++) {
      const it = rollItem(rng, 1 + i, i);
      expect(SLOT_IDS).toContain(it.slot);
      const keys = Object.keys(it.mods) as (keyof RelicMods)[];
      expect(keys.length).toBeGreaterThanOrEqual(1);
      expect(keys.length).toBeLessThanOrEqual(3);
      for (const k of keys) expect(Number.isFinite(it.mods[k])).toBe(true);
    }
  });
});

describe('die() item drop + prune', () => {
  it('caps inventory while always keeping the equipped item and the fresh drop', () => {
    const save = createInitialSave(NOW);
    const weapon: ItemInstance = { uid: save.meta.itemSeq++, slot: 'weapon', rarity: 'legendary', mods: { attackPct: 0.5 } };
    save.meta.inventory.push(weapon);
    save.meta.equipped.weapon = weapon.uid;
    for (let i = 0; i < MAX_INVENTORY + 10; i++) {
      save.meta.inventory.push({ uid: save.meta.itemSeq++, slot: 'ring', rarity: 'common', mods: { critChance: 0.01 } });
    }
    save.run.bestStageThisRun = 10;
    save.run.phase = 'fighting';
    die(save, new Rng(1));

    expect(save.meta.inventory.length).toBeLessThanOrEqual(MAX_INVENTORY);
    expect(save.meta.equipped.weapon).toBe(weapon.uid);
    expect(save.meta.inventory.some((i) => i.uid === weapon.uid)).toBe(true);
    expect(save.run.dropUid).not.toBeNull();
    expect(save.meta.inventory.some((i) => i.uid === save.run.dropUid)).toBe(true);
  });
});
