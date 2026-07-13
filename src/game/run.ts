import {
  RELIC_OFFER_SIZE,
  LEVEL_ATTACK_PCT,
  LEVEL_HP_PCT,
  EVENT_CHANCE,
} from './constants';
import { computeStats } from './stats';
import {
  makeEnemy,
  enemyKindFor,
  essenceForStage,
  rollRarity,
  isFinalWave,
} from './progression';
import { RELICS, relicDef } from './content/relics';
import { EVENTS, EVENT_BY_ID } from './content/events';
import type { EventCtx } from './content/events';
import { CLASSES } from './content/classes';
import { META_BY_ID } from './content/metaNodes';
import { Rng } from './rng';
import type { GameSave, RelicInstance, MetaState, RunState } from './types';

/** Recompute the cached derived stats from class + meta + relics + levels. */
export function recompute(save: GameSave): void {
  save.run.stats = computeStats(save);
}

function metaLevel(meta: MetaState, id: string): number {
  return meta.nodes[id] ?? 0;
}

function essencePctFromMeta(meta: MetaState): number {
  const def = META_BY_ID['attunement'];
  return (def?.essencePct ?? 0) * metaLevel(meta, 'attunement');
}

function extraRelicChoices(meta: MetaState): number {
  return metaLevel(meta, 'foresight');
}

function randomRelic(rng: Rng): RelicInstance {
  return { id: rng.pick(RELICS).id, rarity: rollRarity(rng) };
}

/** Build a de-duplicated relic offer (3 + meta bonus options). */
function rollOffer(save: GameSave, rng: Rng): RelicInstance[] {
  const size = RELIC_OFFER_SIZE + extraRelicChoices(save.meta);
  const offer: RelicInstance[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (offer.length < size && guard < 200) {
    guard++;
    const def = rng.pick(RELICS);
    if (used.has(def.id)) continue;
    used.add(def.id);
    offer.push({ id: def.id, rarity: rollRarity(rng) });
  }
  return offer;
}

/** Fresh run built from the current meta (selected class, head-start, etc.). */
export function startRun(save: GameSave): void {
  const rng = new Rng(save.rngState);
  const meta = save.meta;
  const startStage = Math.max(1, 1 + metaLevel(meta, 'headstart'));
  const cls = CLASSES[meta.selectedClass] ?? CLASSES.warrior;
  const run: RunState = {
    stage: startStage,
    waveInStage: 0,
    gold: 0,
    kills: 0,
    hero: {
      classId: cls.id,
      hp: 1,
      cooldown: 1 / cls.base.attackSpeed,
      bonusAttackPct: 0,
      bonusMaxHpPct: 0,
    },
    enemy: makeEnemy(startStage, enemyKindFor(startStage, 0, rng)),
    relics: [],
    stats: cls.base,
    phase: 'fighting',
    offer: null,
    eventId: null,
    bestStageThisRun: startStage,
    essenceOnDeath: 0,
  };
  save.run = run;
  save.rngState = rng.state;
  recompute(save);
  run.hero.hp = run.stats.maxHp;
}

/**
 * Advance to the next wave. Returns true if the stage was cleared (phase is now
 * 'relic' with a fresh offer). Called by combat right after an enemy dies.
 */
export function advanceWave(save: GameSave, rng: Rng): boolean {
  const run = save.run;
  if (isFinalWave(run.waveInStage)) {
    run.stage += 1;
    run.waveInStage = 0;
    run.bestStageThisRun = Math.max(run.bestStageThisRun, run.stage);
    run.hero.bonusAttackPct += LEVEL_ATTACK_PCT;
    run.hero.bonusMaxHpPct += LEVEL_HP_PCT;
    recompute(save);
    run.hero.hp = run.stats.maxHp; // heal on stage clear
    run.phase = 'relic';
    run.offer = rollOffer(save, rng);
    return true;
  }
  run.waveInStage += 1;
  run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng));
  return false;
}

/** Player (or offline auto-picker) selects a relic from the pending offer. */
export function pickRelic(save: GameSave, index: number): void {
  const run = save.run;
  if (run.phase !== 'relic' || !run.offer) return;
  const chosen = run.offer[index] ?? run.offer[0];
  if (chosen) run.relics.push(chosen);
  run.offer = null;
  recompute(save);
  run.hero.hp = run.stats.maxHp;
  afterChoice(save);
}

/** After a relic pick, either roll an event or resume fighting the next stage. */
function afterChoice(save: GameSave): void {
  const run = save.run;
  const rng = new Rng(save.rngState);
  if (rng.next() < EVENT_CHANCE) {
    run.phase = 'event';
    run.eventId = rng.pick(EVENTS).id;
  } else {
    run.phase = 'fighting';
    run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng));
  }
  save.rngState = rng.state;
}

/** Resolve a pending event by choice index, then resume fighting. */
export function resolveEvent(save: GameSave, choiceIndex: number): void {
  const run = save.run;
  if (run.phase !== 'event' || !run.eventId) return;
  const def = EVENT_BY_ID[run.eventId];
  const rng = new Rng(save.rngState);
  const ctx: EventCtx = {
    healFraction: (s, frac) => {
      s.run.hero.hp = Math.min(s.run.stats.maxHp, s.run.hero.hp + s.run.stats.maxHp * frac);
    },
    grantRelic: (s) => {
      s.run.relics.push(randomRelic(rng));
      recompute(s);
    },
    rng: () => rng.next(),
  };
  const choice = def?.choices[choiceIndex] ?? def?.choices[0];
  choice?.apply(save, ctx);
  save.rngState = rng.state;
  run.eventId = null;
  recompute(save);
  run.hero.hp = Math.min(run.stats.maxHp, Math.max(1, run.hero.hp));
  run.phase = 'fighting';
  const rng2 = new Rng(save.rngState);
  run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng2));
  save.rngState = rng2.state;
}

/** End the current run: award essence and enter the 'dead' phase. */
export function die(save: GameSave): void {
  const run = save.run;
  run.phase = 'dead';
  run.hero.hp = 0;
  const gained = essenceForStage(run.bestStageThisRun, essencePctFromMeta(save.meta));
  run.essenceOnDeath = gained;
  save.meta.essence += gained;
  save.meta.bestStage = Math.max(save.meta.bestStage, run.bestStageThisRun);
  save.meta.bestEssence = Math.max(save.meta.bestEssence, save.meta.essence);
  save.meta.totalRebirths += 1;
}

/** Manual prestige: bank essence for current progress, then start a fresh run. */
export function rebirth(save: GameSave): void {
  if (save.run.phase !== 'dead') {
    save.run.bestStageThisRun = Math.max(save.run.bestStageThisRun, save.run.stage);
    die(save);
  }
  startRun(save);
}

export { relicDef };
