import type { ItemInstance, RelicMods, SlotId, Rarity } from '../types';
import { RARITY_MULT, ITEM_TIER_PCT } from '../constants';
import { rollRarity } from '../progression';
import type { Rng } from '../rng';

interface SlotDef {
  name: string;
  icon: string;
  affixes: (keyof RelicMods)[];
}

// Each slot favors a themed pool of affixes so drops feel role-appropriate.
export const SLOT_DEFS: Record<SlotId, SlotDef> = {
  weapon: { name: 'Weapon', icon: '⚔', affixes: ['attackPct', 'critChance', 'critMult', 'attackSpeedPct'] },
  armor: { name: 'Armor', icon: '🛡', affixes: ['maxHpPct', 'armor', 'thorns', 'lifesteal'] },
  ring: { name: 'Ring', icon: '💍', affixes: ['critChance', 'attackSpeedPct', 'dotDps', 'goldMultPct'] },
  amulet: { name: 'Amulet', icon: '📿', affixes: ['maxHpPct', 'summonPct', 'lifesteal', 'attackPct'] },
};

const AFFIX_BASE: Record<keyof RelicMods, number> = {
  attackPct: 0.06,
  attackSpeedPct: 0.05,
  maxHpPct: 0.08,
  critChance: 0.035,
  critMult: 0.22,
  armor: 3,
  lifesteal: 0.03,
  dotDps: 2,
  summonPct: 0.06,
  goldMultPct: 0.1,
  thorns: 0.06,
};

const SLOT_LIST: SlotId[] = ['weapon', 'armor', 'ring', 'amulet'];
const AFFIX_COUNT: Record<Rarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
};

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Roll a fresh item scaled by rarity and how deep the run reached (`tier`). */
export function rollItem(rng: Rng, tier: number, uid: number): ItemInstance {
  const slot = rng.pick(SLOT_LIST);
  const rarity = rollRarity(rng);
  const scale = RARITY_MULT[rarity] * (1 + ITEM_TIER_PCT * Math.max(0, tier - 1));
  const pool = [...SLOT_DEFS[slot].affixes];
  const n = Math.min(AFFIX_COUNT[rarity], pool.length);
  const mods: RelicMods = {};
  for (let i = 0; i < n; i++) {
    const key = pool.splice(rng.int(pool.length), 1)[0];
    mods[key] = round((AFFIX_BASE[key] ?? 0) * scale);
  }
  return { uid, slot, rarity, mods };
}

export function itemName(item: ItemInstance): string {
  const r = item.rarity;
  return `${r.charAt(0).toUpperCase()}${r.slice(1)} ${SLOT_DEFS[item.slot].name}`;
}

const MOD_WEIGHT: Record<keyof RelicMods, number> = {
  attackPct: 100,
  attackSpeedPct: 100,
  maxHpPct: 80,
  critChance: 140,
  critMult: 30,
  armor: 2,
  lifesteal: 140,
  dotDps: 3,
  summonPct: 100,
  goldMultPct: 40,
  thorns: 40,
};

/** Rough scalar for ranking gear (highest kept when inventory is pruned). */
export function itemPower(item: ItemInstance): number {
  let p = 0;
  for (const [k, v] of Object.entries(item.mods)) {
    p += (v ?? 0) * (MOD_WEIGHT[k as keyof RelicMods] ?? 10);
  }
  return p;
}
