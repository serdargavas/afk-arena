import type { ClassId } from '../types';

// Permanent meta-tree bought with Essence. Each node has levels; cost grows
// geometrically. Effects are read by stats.ts (applyMeta) and run setup.
export interface MetaNodeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  // effect per level (interpreted in stats.ts / progression.ts):
  attackPct?: number;
  attackSpeedPct?: number;
  maxHpPct?: number;
  goldPct?: number;
  essencePct?: number;
  critChance?: number;
  armor?: number;
  lifesteal?: number;
  startStage?: number; // +N starting stage per level
  extraRelicChoice?: number; // +N lucky rarity rerolls on the mystery box per level
  unlockClass?: ClassId; // 1-level nodes that unlock a class
}

export const META_NODES: MetaNodeDef[] = [
  { id: 'might', name: 'Might', icon: '💪', desc: '+8% starting attack / level', maxLevel: 20, baseCost: 2, costGrowth: 1.35, attackPct: 0.08 },
  { id: 'vitality', name: 'Vitality', icon: '❤️', desc: '+8% starting max HP / level', maxLevel: 20, baseCost: 2, costGrowth: 1.35, maxHpPct: 0.08 },
  { id: 'greed', name: 'Greed', icon: '💰', desc: '+12% gold / level', maxLevel: 15, baseCost: 3, costGrowth: 1.4, goldPct: 0.12 },
  { id: 'attunement', name: 'Attunement', icon: '🔷', desc: '+10% essence gained / level', maxLevel: 15, baseCost: 4, costGrowth: 1.45, essencePct: 0.1 },
  { id: 'precision', name: 'Precision', icon: '🎯', desc: '+3% starting crit / level', maxLevel: 10, baseCost: 5, costGrowth: 1.5, critChance: 0.03 },
  { id: 'bulwark', name: 'Bulwark', icon: '🧱', desc: '+2 starting armor / level', maxLevel: 12, baseCost: 4, costGrowth: 1.4, armor: 2 },
  { id: 'headstart', name: 'Head Start', icon: '⏩', desc: 'Begin each run 1 stage higher / level', maxLevel: 20, baseCost: 6, costGrowth: 1.3, startStage: 1 },
  { id: 'foresight', name: 'Foresight', icon: '🔎', desc: 'Mystery box rolls rarity +1 extra time / level (keeps best)', maxLevel: 2, baseCost: 25, costGrowth: 4, extraRelicChoice: 1 },
  { id: 'ferocity', name: 'Ferocity', icon: '⚡', desc: '+4% starting attack speed / level', maxLevel: 15, baseCost: 4, costGrowth: 1.4, attackSpeedPct: 0.04 },
  { id: 'leech', name: 'Leech', icon: '🩸', desc: '+1.5% lifesteal / level', maxLevel: 10, baseCost: 5, costGrowth: 1.45, lifesteal: 0.015 },
];

export const META_BY_ID: Record<string, MetaNodeDef> = Object.fromEntries(
  META_NODES.map((n) => [n.id, n]),
);

/** Essence cost to buy the NEXT level of a node given its current level. */
export function nodeCost(def: MetaNodeDef, currentLevel: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
