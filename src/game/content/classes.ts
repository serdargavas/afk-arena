import type { ClassId, Stats } from '../types';

export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  blurb: string;
  /** Base combat profile before relics/meta/levels. */
  base: Stats;
}

// Signature traits are baked into base stats: Warrior tanks + thorns, Mage bursts
// with crit + poison, Ranger machine-guns with a summon companion.
export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    icon: '🛡',
    blurb: 'Immovable tank. Slow, heavy blows; facetanks with armor, reflects damage and heals off hits.',
    base: {
      maxHp: 210,
      attack: 14,
      attackSpeed: 0.95,
      critChance: 0.05,
      critMult: 2,
      armor: 7,
      lifesteal: 0.09,
      dotDps: 0,
      summonPct: 0,
      goldMult: 1,
      thorns: 0.3,
    },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    blurb: 'Glass cannon. Enormous crits and searing poison — but almost no armor or HP.',
    base: {
      maxHp: 58,
      attack: 10,
      attackSpeed: 0.9,
      critChance: 0.4,
      critMult: 3.2,
      armor: 0,
      lifesteal: 0,
      dotDps: 6,
      summonPct: 0,
      goldMult: 1,
      thorns: 0,
    },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    blurb: 'Machine-gun striker. Blistering attack speed and a companion that mirrors a chunk of your damage.',
    base: {
      maxHp: 105,
      attack: 4.5,
      attackSpeed: 2.7,
      critChance: 0.15,
      critMult: 2,
      armor: 1,
      lifesteal: 0.02,
      dotDps: 0,
      summonPct: 0.4,
      goldMult: 1,
      thorns: 0,
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES);
