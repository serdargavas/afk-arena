import type { Rarity } from './types';

// --- Simulation timing ---
export const TICK_RATE = 10;
export const TICK_DT = 1 / TICK_RATE; // 0.1s
export const TICK_DT_MS = 1000 / TICK_RATE; // 100ms
export const MAX_STEPS_PER_FRAME = 5; // spiral-of-death guard (<=500ms/frame)
// Kept == MAX_STEPS_PER_FRAME*TICK_DT_MS so no real-time gap is dropped between
// the accumulator ceiling and the bulk path (review finding #4).
export const BULK_CATCHUP_THRESHOLD_MS = 500;
export const MAX_ATTACKS_PER_TICK = 20; // per-side combat loop guard (finding #2 class)

// --- Offline progression ---
export const MAX_OFFLINE_SECONDS = 12 * 3600;
export const MAX_OFFLINE_ITERS = 200_000;

// --- Cadences ---
export const STORE_PUSH_INTERVAL_MS = 250; // HUD refresh (~4/sec)
export const AUTOSAVE_INTERVAL_MS = 10_000;
export const UNFOCUSED_FRAME_INTERVAL_MS = 200; // ~5fps when blurred

// --- Progression ---
export const STAGE_KILLS = 8; // enemies to clear a stage (last one is elite/boss)
export const BIOME_STAGES = 5; // stages per biome before it cycles
export const BOSS_EVERY = 5; // the final enemy of every Nth stage is a boss
export const ELITE_CHANCE = 0.16; // chance a mid-stage enemy is an elite
export const EVENT_CHANCE = 0.35; // chance of a random event after a stage clear

// --- Enemy scaling ---
export const BASE_ENEMY_HP = 18;
export const ENEMY_HP_GROWTH = 1.17;
export const BASE_ENEMY_ATK = 3;
export const ENEMY_ATK_GROWTH = 1.14;
export const ENEMY_ATK_SPEED = 0.85;
export const BASE_GOLD = 6;
export const GOLD_GROWTH = 1.13;

export const ELITE_HP_MULT = 4.5;
export const ELITE_ATK_MULT = 1.55;
export const ELITE_GOLD_MULT = 5;
export const ELITE_ATK_SPEED = 0.95;

export const BOSS_HP_MULT = 14;
export const BOSS_ATK_MULT = 2.3;
export const BOSS_GOLD_MULT = 18;
export const BOSS_ATK_SPEED = 0.7;

// --- In-run level (each stage clear) ---
export const LEVEL_ATTACK_PCT = 0.08;
export const LEVEL_HP_PCT = 0.06;

// --- In-run gold shop (gold sink) ---
export const SHOP_ATTACK_PCT = 0.06; // +6% attack per level
export const SHOP_HP_PCT = 0.06; // +6% max HP per level
export const SHOP_SPEED_PCT = 0.035; // +3.5% attack speed per level
export const SHOP_BASE_COST: Record<'attack' | 'hp' | 'speed', number> = {
  attack: 25,
  hp: 25,
  speed: 45,
};
export const SHOP_COST_GROWTH = 1.5;

// --- Auto-relic convenience ---
export const AUTO_RELIC_DELAY_MS = 2000;

// --- Rarity ---
export const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.6,
  rare: 2.4,
  epic: 3.6,
  legendary: 5.5,
};
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 60,
  uncommon: 26,
  rare: 10,
  epic: 3.2,
  legendary: 0.8,
};

// --- Essence (prestige currency) ---
export const ESSENCE_BASE = 0.6;
export const ESSENCE_STAGE_POW = 1.5;

// --- Misc ---
export const RELIC_OFFER_SIZE = 3;
export const SAVE_VERSION = 2;
export const DEFAULT_SEED = 0x9e3779b9;
