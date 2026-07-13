import type { GameSave, Stats, RelicInstance } from './types';
import { RARITY_MULT, SHOP_ATTACK_PCT, SHOP_HP_PCT, SHOP_SPEED_PCT } from './constants';
import { CLASSES } from './content/classes';
import { relicDef } from './content/relics';
import { META_NODES } from './content/metaNodes';

interface Accum {
  attackPct: number;
  attackSpeedPct: number;
  maxHpPct: number;
  goldMultPct: number;
  critChance: number;
  critMult: number;
  armor: number;
  lifesteal: number;
  dotDps: number;
  summonPct: number;
  thorns: number;
}

function emptyAccum(): Accum {
  return {
    attackPct: 0,
    attackSpeedPct: 0,
    maxHpPct: 0,
    goldMultPct: 0,
    critChance: 0,
    critMult: 0,
    armor: 0,
    lifesteal: 0,
    dotDps: 0,
    summonPct: 0,
    thorns: 0,
  };
}

function addRelic(acc: Accum, relic: RelicInstance): void {
  const def = relicDef(relic.id);
  if (!def) return;
  const k = RARITY_MULT[relic.rarity] ?? 1;
  const m = def.mods;
  acc.attackPct += (m.attackPct ?? 0) * k;
  acc.attackSpeedPct += (m.attackSpeedPct ?? 0) * k;
  acc.maxHpPct += (m.maxHpPct ?? 0) * k;
  acc.goldMultPct += (m.goldMultPct ?? 0) * k;
  acc.critChance += (m.critChance ?? 0) * k;
  acc.critMult += (m.critMult ?? 0) * k;
  acc.armor += (m.armor ?? 0) * k;
  acc.lifesteal += (m.lifesteal ?? 0) * k;
  acc.dotDps += (m.dotDps ?? 0) * k;
  acc.summonPct += (m.summonPct ?? 0) * k;
  acc.thorns += (m.thorns ?? 0) * k;
}

function addMeta(acc: Accum, nodes: Record<string, number>): void {
  for (const def of META_NODES) {
    const lvl = nodes[def.id] ?? 0;
    if (lvl <= 0) continue;
    acc.attackPct += (def.attackPct ?? 0) * lvl;
    acc.maxHpPct += (def.maxHpPct ?? 0) * lvl;
    acc.goldMultPct += (def.goldPct ?? 0) * lvl;
    acc.critChance += (def.critChance ?? 0) * lvl;
    acc.armor += (def.armor ?? 0) * lvl;
  }
}

/**
 * Derive the current combat profile from class base + meta + relics + in-run
 * level bonuses. Pure; call whenever any of those inputs change.
 */
export function computeStats(save: GameSave): Stats {
  const run = save.run;
  const cls = CLASSES[run.hero.classId] ?? CLASSES.warrior;
  const base = cls.base;
  const acc = emptyAccum();
  addMeta(acc, save.meta.nodes);
  for (const r of run.relics) addRelic(acc, r);

  const shop = run.shop;
  const attackPct = acc.attackPct + run.hero.bonusAttackPct + SHOP_ATTACK_PCT * shop.attack;
  const maxHpPct = acc.maxHpPct + run.hero.bonusMaxHpPct + SHOP_HP_PCT * shop.hp;
  const attackSpeedPct = acc.attackSpeedPct + SHOP_SPEED_PCT * shop.speed;

  return {
    maxHp: Math.max(1, Math.round(base.maxHp * (1 + maxHpPct))),
    attack: Math.max(0.1, base.attack * (1 + attackPct)),
    attackSpeed: Math.max(0.1, base.attackSpeed * (1 + attackSpeedPct)),
    critChance: clamp01(base.critChance + acc.critChance),
    critMult: Math.max(1, base.critMult + acc.critMult),
    armor: Math.max(0, base.armor + acc.armor),
    lifesteal: clamp01(base.lifesteal + acc.lifesteal),
    dotDps: Math.max(0, base.dotDps + acc.dotDps),
    summonPct: Math.max(0, base.summonPct + acc.summonPct),
    goldMult: Math.max(0, base.goldMult * (1 + acc.goldMultPct)),
    thorns: Math.max(0, base.thorns + acc.thorns),
  };
}

/** Expected hero DPS including crits, poison and summon — used by offline calc. */
export function expectedDps(stats: Stats): number {
  const critBonus = stats.critChance * (stats.critMult - 1);
  const hitDps = stats.attack * stats.attackSpeed * (1 + critBonus);
  const summonDps = stats.summonPct * stats.attack * stats.attackSpeed;
  return hitDps + summonDps + stats.dotDps;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
