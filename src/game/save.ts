import { SAVE_VERSION, DEFAULT_SEED, STAGE_KILLS, ENEMY_ATK_SPEED } from './constants';
import { seedFrom } from './rng';
import { startRun, recompute } from './run';
import { makeEnemy, isFinalWave, isBossStage } from './progression';
import { relicDef } from './content/relics';
import { CLASSES } from './content/classes';
import { META_BY_ID } from './content/metaNodes';
import { EVENT_BY_ID } from './content/events';
import { RARITIES } from './types';
import type {
  GameSave,
  MetaState,
  RunState,
  EnemyState,
  RelicInstance,
  ClassId,
  RunPhase,
} from './types';

export function createInitialSave(now: number, seed: number = DEFAULT_SEED): GameSave {
  const save: GameSave = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    rngState: seedFrom(seed),
    meta: {
      essence: 0,
      nodes: {},
      unlockedClasses: ['warrior'],
      selectedClass: 'warrior',
      bestStage: 1,
      bestEssence: 0,
      totalRebirths: 0,
      settings: { alwaysOnTop: false, overFullscreen: false, autoRelic: false },
      playerId: '',
      playerName: '',
    },
    run: undefined as unknown as RunState, // filled by startRun
  };
  startRun(save);
  return save;
}

export function serialize(save: GameSave): string {
  return JSON.stringify(save);
}

/**
 * Parse + validate a save. Returns null on unrecoverable corruption / version
 * mismatch so the caller falls back to a fresh save. Derived combat stats are
 * always rebuilt from class base here (never trusted from disk), which makes the
 * save robust by construction — no persisted field can soft-lock or hang the sim.
 */
export function deserialize(raw: string, now: number): GameSave | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.version !== SAVE_VERSION) return null; // pre-release: no migration path
  try {
    return sanitize(d, now);
  } catch {
    return null;
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function sanitize(d: Record<string, unknown>, now: number): GameSave {
  const base = createInitialSave(now);
  const meta = sanitizeMeta(d.meta as Record<string, unknown> | undefined);
  const save: GameSave = {
    version: SAVE_VERSION,
    createdAt: num(d.createdAt, now),
    lastSeen: num(d.lastSeen, now),
    rngState: (num(d.rngState, base.rngState) >>> 0) || base.rngState,
    meta,
    run: base.run,
  };
  save.run = sanitizeRun(d.run as Record<string, unknown> | undefined, save);
  recompute(save);
  save.run.hero.hp = clamp(save.run.hero.hp, save.run.phase === 'dead' ? 0 : 1, save.run.stats.maxHp);
  return save;
}

function sanitizeMeta(m: Record<string, unknown> | undefined): MetaState {
  const nodes: Record<string, number> = {};
  const rawNodes = (m?.nodes ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawNodes)) {
    const def = META_BY_ID[k];
    if (def && Number.isFinite(v as number)) {
      nodes[k] = clamp(Math.floor(v as number), 0, def.maxLevel);
    }
  }
  const unlocked = Array.isArray(m?.unlockedClasses)
    ? (m!.unlockedClasses as unknown[]).filter((c): c is ClassId => typeof c === 'string' && c in CLASSES)
    : [];
  if (!unlocked.includes('warrior')) unlocked.push('warrior');
  let selected = (typeof m?.selectedClass === 'string' && m.selectedClass in CLASSES
    ? m.selectedClass
    : 'warrior') as ClassId;
  if (!unlocked.includes(selected)) selected = 'warrior';
  const s = (m?.settings ?? {}) as Record<string, unknown>;
  return {
    essence: Math.max(0, num(m?.essence, 0)),
    nodes,
    unlockedClasses: unlocked,
    selectedClass: selected,
    bestStage: Math.max(1, Math.floor(num(m?.bestStage, 1))),
    bestEssence: Math.max(0, num(m?.bestEssence, 0)),
    totalRebirths: Math.max(0, Math.floor(num(m?.totalRebirths, 0))),
    settings: {
      alwaysOnTop: !!s.alwaysOnTop,
      overFullscreen: !!s.overFullscreen,
      autoRelic: !!s.autoRelic,
    },
    playerId: typeof m?.playerId === 'string' ? m.playerId : '',
    playerName: typeof m?.playerName === 'string' ? m.playerName : '',
  };
}

function sanitizeRelics(v: unknown): RelicInstance[] {
  if (!Array.isArray(v)) return [];
  const out: RelicInstance[] = [];
  for (const x of v) {
    const o = x as { id?: unknown; rarity?: unknown };
    if (o && typeof o.id === 'string' && relicDef(o.id) && RARITIES.includes(o.rarity as never)) {
      out.push({ id: o.id, rarity: o.rarity as RelicInstance['rarity'] });
    }
  }
  return out;
}

function sanitizeEnemy(v: unknown, stage: number, waveInStage: number): EnemyState {
  const e = v as Partial<EnemyState> | undefined;
  const valid =
    e &&
    Number.isFinite(e.maxHp) && (e.maxHp as number) > 0 &&
    Number.isFinite(e.hp) && (e.hp as number) > 0 &&
    Number.isFinite(e.attack) && (e.attack as number) > 0;
  if (valid) {
    const kind = e!.kind === 'elite' || e!.kind === 'boss' ? e!.kind : 'normal';
    return {
      kind,
      maxHp: e!.maxHp as number,
      hp: Math.min(e!.hp as number, e!.maxHp as number),
      attack: Math.max(1, e!.attack as number),
      attackSpeed: Math.max(0.1, num(e!.attackSpeed, ENEMY_ATK_SPEED)),
      cooldown: Math.max(0, num(e!.cooldown, 1)),
      goldReward: Math.max(1, num(e!.goldReward, 1)),
      flash: 0,
    };
  }
  // Corrupt/missing enemy → regenerate one appropriate to the current position.
  const kind = isFinalWave(waveInStage) ? (isBossStage(stage) ? 'boss' : 'elite') : 'normal';
  return makeEnemy(stage, kind);
}

function sanitizeRun(r: Record<string, unknown> | undefined, save: GameSave): RunState {
  const heroRaw = (r?.hero ?? {}) as Record<string, unknown>;
  const classId = (typeof heroRaw.classId === 'string' && heroRaw.classId in CLASSES
    ? heroRaw.classId
    : save.meta.selectedClass) as ClassId;
  const stage = Math.max(1, Math.floor(num(r?.stage, 1)));
  const waveInStage = clamp(Math.floor(num(r?.waveInStage, 0)), 0, STAGE_KILLS - 1);

  const relics = sanitizeRelics(r?.relics);
  const offerRaw = sanitizeRelics(r?.offer);
  const offer = offerRaw.length > 0 ? offerRaw : null;

  let phase: RunPhase = ['fighting', 'relic', 'event', 'dead'].includes(r?.phase as string)
    ? (r!.phase as RunPhase)
    : 'fighting';
  if (phase === 'relic' && !offer) phase = 'fighting';
  const eventId =
    typeof r?.eventId === 'string' && EVENT_BY_ID[r.eventId] ? r.eventId : null;
  if (phase === 'event' && !eventId) phase = 'fighting';

  const cls = CLASSES[classId];
  const shopRaw = (r?.shop ?? {}) as Record<string, unknown>;
  return {
    stage,
    waveInStage,
    gold: Math.max(0, num(r?.gold, 0)),
    kills: Math.max(0, Math.floor(num(r?.kills, 0))),
    shop: {
      attack: Math.max(0, Math.floor(num(shopRaw.attack, 0))),
      hp: Math.max(0, Math.floor(num(shopRaw.hp, 0))),
      speed: Math.max(0, Math.floor(num(shopRaw.speed, 0))),
    },
    hero: {
      classId,
      hp: Math.max(0, num(heroRaw.hp, cls.base.maxHp)),
      cooldown: Math.max(0, num(heroRaw.cooldown, 1 / cls.base.attackSpeed)),
      bonusAttackPct: Math.max(0, num(heroRaw.bonusAttackPct, 0)),
      bonusMaxHpPct: Math.max(0, num(heroRaw.bonusMaxHpPct, 0)),
    },
    enemy: sanitizeEnemy(r?.enemy, stage, waveInStage),
    relics,
    stats: cls.base, // recomputed by sanitize()
    phase,
    offer,
    eventId,
    bestStageThisRun: Math.max(stage, Math.floor(num(r?.bestStageThisRun, stage))),
    essenceOnDeath: Math.max(0, num(r?.essenceOnDeath, 0)),
  };
}
