import {
  SAVE_VERSION,
  DEFAULT_SEED,
  HERO_BASE_ATTACK,
  HERO_BASE_ATTACK_SPEED,
  HERO_BASE_CRIT_CHANCE,
  HERO_BASE_CRIT_MULT,
} from './constants';
import { spawnEnemy } from './economy';
import { seedFrom } from './rng';
import type { GameState } from './types';

export function createInitialState(now: number, seed: number = DEFAULT_SEED): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    rngState: seedFrom(seed),
    gold: 0,
    wave: 1,
    kills: 0,
    hero: {
      attack: HERO_BASE_ATTACK,
      attackSpeed: HERO_BASE_ATTACK_SPEED,
      critChance: HERO_BASE_CRIT_CHANCE,
      critMult: HERO_BASE_CRIT_MULT,
      cooldown: 1 / HERO_BASE_ATTACK_SPEED,
    },
    enemy: spawnEnemy(1),
  };
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Parse + migrate + validate. Returns null on unrecoverable corruption so the
 * caller can fall back to a fresh state (rather than crashing the game).
 */
export function deserialize(raw: string, now: number): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  return migrate(data as Record<string, unknown>, now);
}

function migrate(data: Record<string, unknown>, now: number): GameState | null {
  // v1 is the first version. Fill any missing fields from a fresh baseline so
  // older/partial saves still load; future versions branch on data.version here.
  const base = createInitialState(now);
  const hero = (data.hero as object) ?? {};
  const enemy = (data.enemy as object) ?? {};
  const state: GameState = {
    ...base,
    ...data,
    hero: { ...base.hero, ...hero },
    enemy: { ...base.enemy, ...enemy },
    version: SAVE_VERSION,
  };

  // Sanity clamps — treat nonsense as corruption or reset to safe defaults.
  if (!Number.isFinite(state.gold) || state.gold < 0) return null;
  if (!Number.isFinite(state.wave) || state.wave < 1) state.wave = 1;
  if (!Number.isFinite(state.kills) || state.kills < 0) state.kills = 0;
  if (!Number.isFinite(state.lastSeen)) state.lastSeen = now;
  if (!Number.isFinite(state.enemy.hp) || state.enemy.hp <= 0) {
    state.enemy = spawnEnemy(state.wave);
  }
  return state;
}
