// Core simulation types (v2 — roguelite). The `game/` layer stays framework-free.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export type Archetype = 'attack' | 'speed' | 'crit' | 'dot' | 'summon' | 'tank' | 'gold';

export type ClassId = 'warrior' | 'mage' | 'ranger';

export type EnemyKind = 'normal' | 'elite' | 'boss';

export type RunPhase = 'fighting' | 'relic' | 'event' | 'dead';

/** Derived combat profile — recomputed only when relics/level/meta/class change. */
export interface Stats {
  maxHp: number;
  attack: number;
  attackSpeed: number; // attacks/sec
  critChance: number; // 0..1
  critMult: number;
  armor: number; // flat reduction per incoming hit
  lifesteal: number; // 0..1 of damage dealt healed back
  dotDps: number; // flat damage/sec always applied to the current enemy
  summonPct: number; // companion dps as a fraction of attack*attackSpeed
  goldMult: number; // multiplier on gold (1 = base)
  thorns: number; // fraction of incoming raw damage reflected
}

/** Which derived stats a relic touches. Percentages are additive then applied. */
export interface RelicMods {
  attackPct?: number;
  attackSpeedPct?: number;
  maxHpPct?: number;
  critChance?: number;
  critMult?: number;
  armor?: number;
  lifesteal?: number;
  dotDps?: number;
  summonPct?: number;
  goldMultPct?: number;
  thorns?: number;
}

export interface RelicDef {
  id: string;
  name: string;
  archetype: Archetype;
  icon: string; // single glyph — cheap "art"
  desc: string;
  mods: RelicMods; // base (common) magnitude; scaled by rolled rarity
}

export interface RelicInstance {
  id: string; // RelicDef id
  rarity: Rarity;
}

export interface HeroState {
  classId: ClassId;
  hp: number;
  cooldown: number; // seconds to next hero attack
  bonusAttackPct: number; // accrued from stage-clear levels this run
  bonusMaxHpPct: number;
}

export interface EnemyState {
  kind: EnemyKind;
  maxHp: number;
  hp: number;
  attack: number;
  attackSpeed: number;
  cooldown: number; // seconds to next enemy attack
  goldReward: number;
  flash: number; // hit-flash timer (render juice)
}

export interface RunState {
  stage: number; // 1-based
  waveInStage: number; // 0..STAGE_KILLS-1
  gold: number;
  kills: number;
  hero: HeroState;
  enemy: EnemyState;
  relics: RelicInstance[];
  stats: Stats; // cached derived profile
  phase: RunPhase;
  offer: RelicInstance[] | null; // pending 3-choose-1
  eventId: string | null; // pending event
  bestStageThisRun: number;
  essenceOnDeath: number; // essence awarded when this run ended (for the death screen)
}

export interface Settings {
  alwaysOnTop: boolean;
  overFullscreen: boolean; // visible on all Spaces / above other fullscreen apps
}

export interface MetaState {
  essence: number;
  nodes: Record<string, number>; // metaNodeId -> purchased level
  unlockedClasses: ClassId[];
  selectedClass: ClassId;
  bestStage: number;
  bestEssence: number;
  totalRebirths: number;
  settings: Settings;
  // leaderboard identity (wired to Supabase later; empty by default)
  playerId: string;
  playerName: string;
}

export interface GameSave {
  version: number;
  createdAt: number;
  lastSeen: number; // ms epoch; drives offline calc
  rngState: number; // seedable PRNG state
  meta: MetaState;
  run: RunState;
}

/** Lightweight, React-facing view pushed into the store (~4x/sec). */
export interface UISnapshot {
  phase: RunPhase;
  stage: number;
  waveInStage: number;
  biomeName: string;
  gold: number;
  essence: number;
  kills: number;
  dps: number;
  heroHp: number;
  heroMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyKind: EnemyKind;
  relicCount: number;
  bestStage: number;
}

export interface OfflineReport {
  seconds: number;
  goldGained: number;
  kills: number;
  stagesCleared: number;
  relicsGained: number;
  died: boolean;
  capped: boolean;
}
