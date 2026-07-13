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
    blurb: 'Tanky bruiser. High HP, armor, thorns and a little lifesteal.',
    base: {
      maxHp: 130,
      attack: 6,
      attackSpeed: 1.2,
      critChance: 0.08,
      critMult: 2,
      armor: 3,
      lifesteal: 0.03,
      dotDps: 0,
      summonPct: 0,
      goldMult: 1,
      thorns: 0.1,
    },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    blurb: 'Glass cannon. Big crits and innate poison, but fragile.',
    base: {
      maxHp: 74,
      attack: 10,
      attackSpeed: 1.0,
      critChance: 0.2,
      critMult: 2.3,
      armor: 0,
      lifesteal: 0,
      dotDps: 2,
      summonPct: 0,
      goldMult: 1,
      thorns: 0,
    },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    blurb: 'Fast attacker with a summoned companion adding steady damage.',
    base: {
      maxHp: 92,
      attack: 4,
      attackSpeed: 2.0,
      critChance: 0.12,
      critMult: 2,
      armor: 1,
      lifesteal: 0,
      dotDps: 0,
      summonPct: 0.18,
      goldMult: 1,
      thorns: 0,
    },
  },
};

export const CLASS_LIST = Object.values(CLASSES);
