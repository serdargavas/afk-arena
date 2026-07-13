// Core simulation types. The `game/` layer knows nothing about React/Tauri/DOM.

export type EnemyKind = 'normal'; // widened in Phase 2 (elite/boss/…)

export interface HeroState {
  attack: number;
  attackSpeed: number; // attacks per second
  critChance: number; // 0..1
  critMult: number;
  cooldown: number; // seconds until the next attack lands
}

export interface EnemyState {
  maxHp: number;
  hp: number;
  goldReward: number;
  kind: EnemyKind;
  flash: number; // hit-flash timer (seconds) — render-only juice
}

export interface GameState {
  version: number;
  createdAt: number; // ms epoch
  lastSeen: number; // ms epoch — updated each frame/save; drives offline calc
  rngState: number; // seedable PRNG state
  gold: number;
  wave: number; // 1-based
  kills: number;
  hero: HeroState;
  enemy: EnemyState;
}

/** Lightweight, React-facing view pushed into the store (~3x/sec). */
export interface UISnapshot {
  gold: number;
  wave: number;
  kills: number;
  dps: number;
  enemyHp: number;
  enemyMaxHp: number;
}

/** Result of an offline / stall catch-up, surfaced in the "welcome back" modal. */
export interface OfflineReport {
  seconds: number; // capped elapsed seconds actually simulated
  goldGained: number;
  kills: number;
  wavesCleared: number;
  capped: boolean; // true if real elapsed exceeded MAX_OFFLINE_SECONDS
}
