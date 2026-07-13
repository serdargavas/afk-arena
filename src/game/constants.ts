// Central tuning knobs. Kept framework-free so the whole sim stays testable.

// --- Simulation timing ---
export const TICK_RATE = 10; // fixed simulation ticks per second
export const TICK_DT = 1 / TICK_RATE; // seconds per tick (0.1s)
export const TICK_DT_MS = 1000 / TICK_RATE; // 100ms
export const MAX_STEPS_PER_FRAME = 5; // spiral-of-death guard (<=500ms catch-up / frame)

// A real-time gap larger than this (ms) is treated as a stall/minimize/sleep and
// folded in analytically via applyOffline instead of stepping tick-by-tick.
export const BULK_CATCHUP_THRESHOLD_MS = 1000;

// --- Offline progression ---
export const MAX_OFFLINE_SECONDS = 12 * 3600; // cap accrual at 12h
export const MAX_OFFLINE_ITERS = 200_000; // loop cap for bulk offline calc

// --- Cadences (keep React + IO cheap) ---
export const STORE_PUSH_INTERVAL_MS = 300; // HUD refresh (~3/sec)
export const AUTOSAVE_INTERVAL_MS = 10_000; // autosave every 10s
export const UNFOCUSED_FRAME_INTERVAL_MS = 200; // render ~5fps when window blurred

// --- Economy / combat tuning ---
export const BASE_ENEMY_HP = 10;
export const ENEMY_HP_GROWTH = 1.15; // per wave
export const BASE_GOLD = 5;
export const GOLD_GROWTH = 1.12; // per wave

export const HERO_BASE_ATTACK = 4;
export const HERO_BASE_ATTACK_SPEED = 1.4; // attacks per second
export const HERO_BASE_CRIT_CHANCE = 0.15;
export const HERO_BASE_CRIT_MULT = 2;

export const SAVE_VERSION = 1;
export const DEFAULT_SEED = 0x9e3779b9;
