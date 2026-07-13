import {
  BASE_ENEMY_HP,
  ENEMY_HP_GROWTH,
  BASE_GOLD,
  GOLD_GROWTH,
} from './constants';
import type { EnemyState, HeroState } from './types';

export function enemyHpForWave(wave: number): number {
  return Math.ceil(BASE_ENEMY_HP * Math.pow(ENEMY_HP_GROWTH, wave - 1));
}

export function goldForWave(wave: number): number {
  return Math.ceil(BASE_GOLD * Math.pow(GOLD_GROWTH, wave - 1));
}

export function spawnEnemy(wave: number): EnemyState {
  const maxHp = enemyHpForWave(wave);
  return { maxHp, hp: maxHp, goldReward: goldForWave(wave), kind: 'normal', flash: 0 };
}

/**
 * Expected damage per second including crits. Used by the analytic offline calc
 * (crits are averaged in rather than rolled per hit).
 */
export function heroDps(hero: HeroState): number {
  const critBonus = hero.critChance * (hero.critMult - 1);
  return hero.attack * hero.attackSpeed * (1 + critBonus);
}
