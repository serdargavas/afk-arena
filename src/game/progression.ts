import {
  STAGE_KILLS,
  BIOME_STAGES,
  BOSS_EVERY,
  ELITE_CHANCE,
  BASE_ENEMY_HP,
  ENEMY_HP_GROWTH,
  BASE_ENEMY_ATK,
  ENEMY_ATK_GROWTH,
  ENEMY_ATK_SPEED,
  BASE_GOLD,
  GOLD_GROWTH,
  ELITE_HP_MULT,
  ELITE_ATK_MULT,
  ELITE_GOLD_MULT,
  ELITE_ATK_SPEED,
  BOSS_HP_MULT,
  BOSS_ATK_MULT,
  BOSS_GOLD_MULT,
  BOSS_ATK_SPEED,
  ESSENCE_BASE,
  ESSENCE_STAGE_POW,
  RARITY_WEIGHT,
} from './constants';
import { biomeForStage } from './content/biomes';
import type { EnemyKind, EnemyState, Rarity } from './types';
import { RARITIES } from './types';
import type { Rng } from './rng';

export { biomeForStage };

export function biomeName(stage: number): string {
  return biomeForStage(stage, BIOME_STAGES).name;
}

/** Is the given wave index the last (boss/elite) wave of its stage? */
export function isFinalWave(waveInStage: number): boolean {
  return waveInStage >= STAGE_KILLS - 1;
}

export function isBossStage(stage: number): boolean {
  return stage % BOSS_EVERY === 0;
}

/** Decide the enemy kind for a given stage + wave (+rng for mid-wave elites). */
export function enemyKindFor(stage: number, waveInStage: number, rng: Rng): EnemyKind {
  if (isFinalWave(waveInStage)) return isBossStage(stage) ? 'boss' : 'elite';
  return rng.next() < ELITE_CHANCE ? 'elite' : 'normal';
}

function kindMults(kind: EnemyKind): { hp: number; atk: number; gold: number; spd: number } {
  switch (kind) {
    case 'elite':
      return { hp: ELITE_HP_MULT, atk: ELITE_ATK_MULT, gold: ELITE_GOLD_MULT, spd: ELITE_ATK_SPEED };
    case 'boss':
      return { hp: BOSS_HP_MULT, atk: BOSS_ATK_MULT, gold: BOSS_GOLD_MULT, spd: BOSS_ATK_SPEED };
    default:
      return { hp: 1, atk: 1, gold: 1, spd: ENEMY_ATK_SPEED };
  }
}

export function makeEnemy(stage: number, kind: EnemyKind): EnemyState {
  const m = kindMults(kind);
  const hp = Math.ceil(BASE_ENEMY_HP * Math.pow(ENEMY_HP_GROWTH, stage - 1) * m.hp);
  const attack = Math.max(1, BASE_ENEMY_ATK * Math.pow(ENEMY_ATK_GROWTH, stage - 1) * m.atk);
  const goldReward = Math.ceil(BASE_GOLD * Math.pow(GOLD_GROWTH, stage - 1) * m.gold);
  const attackSpeed = m.spd; // elite/boss carry their own cadence; normal = ENEMY_ATK_SPEED
  return {
    kind,
    maxHp: hp,
    hp,
    attack,
    attackSpeed,
    cooldown: 1 / attackSpeed,
    goldReward,
    flash: 0,
  };
}

/** Essence awarded for a run that reached `bestStage`, scaled by meta bonus. */
export function essenceForStage(bestStage: number, essencePct: number): number {
  const raw = ESSENCE_BASE * Math.pow(Math.max(0, bestStage - 1), ESSENCE_STAGE_POW);
  return Math.floor(raw * (1 + essencePct));
}

/** Roll a rarity using the global weights, then bias up by `luck` extra rolls. */
export function rollRarity(rng: Rng): Rarity {
  const weights = RARITIES.map((r) => RARITY_WEIGHT[r]);
  return RARITIES[rng.weightedIndex(weights)];
}
