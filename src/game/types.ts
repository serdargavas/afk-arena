// Core simulation types (v2 — roguelite). The `game/` layer stays framework-free.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export type Archetype = 'attack' | 'speed' | 'crit' | 'dot' | 'summon' | 'tank' | 'gold';

export type ClassId = 'warrior' | 'mage' | 'ranger';

export type EnemyKind = 'normal' | 'elite' | 'boss';

export type SlotId = 'weapon' | 'armor' | 'ring' | 'amulet';
export const SLOT_IDS: SlotId[] = ['weapon', 'armor', 'ring', 'amulet'];

/** A permanent piece of gear. `mods` are already rarity-scaled at drop time. */
export interface ItemInstance {
  uid: number;
  slot: SlotId;
  rarity: Rarity;
  mods: RelicMods;
}

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

export interface ShopLevels {
  attack: number;
  hp: number;
  speed: number;
}

export type ShopKey = keyof ShopLevels;

export interface RunState {
  stage: number; // 1-based
  waveInStage: number; // 0..STAGE_KILLS-1
  gold: number;
  kills: number;
  shop: ShopLevels; // in-run gold upgrades (reset each run)
  hero: HeroState;
  enemy: EnemyState;
  relics: RelicInstance[];
  stats: Stats; // cached derived profile
  phase: RunPhase;
  offer: RelicInstance[] | null; // pending 3-choose-1
  eventId: string | null; // pending event
  bestStageThisRun: number;
  essenceOnDeath: number; // essence awarded when this run ended (for the death screen)
  dropUid: number | null; // item uid dropped on death (shown on the death screen)
  spawnGrace: number; // seconds of ceasefire while the next enemy walks in
}

export interface Settings {
  alwaysOnTop: boolean;
  overFullscreen: boolean; // visible on all Spaces / above other fullscreen apps
  autoRelic: boolean; // auto-pick a relic after AUTO_RELIC_DELAY_MS (see constants)
  autoBuy: boolean; // auto-spend gold on shop upgrades as it comes in
  gameSpeed: number; // sim speed multiplier: 1, 2, or 3
}

/** Daily-quest counters + login streak. `day` is the local date the counters
 *  belong to; a new day resets them (streak fields survive rollover). */
export interface DailyState {
  day: string; // local YYYY-MM-DD
  kills: number;
  stages: number;
  boxes: number;
  rebirths: number;
  shopBuys: number;
  activeSeconds: number;
  claimed: number[]; // milestone point-thresholds already claimed today
  streak: number; // total streak days claimed (calendar slot = streak % 7)
  lastStreakDay: string; // local day the streak chest was last claimed ('' = never)
}

export interface MetaState {
  essence: number;
  nodes: Record<string, number>; // metaNodeId -> purchased level
  skills: Record<string, number>; // skillNodeId -> 1 when allocated (cap SKILL_POINTS)
  inventory: ItemInstance[]; // permanent gear collected from drops
  equipped: Record<SlotId, number | null>; // slot -> equipped item uid
  itemSeq: number; // monotonic source of item uids
  unlockedClasses: ClassId[];
  selectedClass: ClassId;
  bestStage: number;
  bestEssence: number;
  totalRebirths: number;
  settings: Settings;
  daily: DailyState;
  pity: number; // mystery boxes opened since the last epic+ (guarantee counter)
  codex: Record<string, number>; // relicId -> best rarity index ever obtained
  seenItemUid: number; // highest item uid the player has viewed in the Gear tab
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
  heroClass: ClassId;
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
  essenceIfRebirth: number; // essence you'd bank by rebirthing right now
  dailyClaimable: number; // claimable daily milestones + streak chest (badge count)
  badgeMeta: number; // meta nodes affordable right now
  badgeSkills: number; // unspent skill points
  badgeGear: number; // items dropped since the Gear tab was last closed (seen)
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
