import {
  RELIC_EVERY_STAGES,
  LEVEL_ATTACK_PCT,
  LEVEL_HP_PCT,
  EVENT_CHANCE,
  SHOP_BASE_COST,
  SHOP_COST_GROWTH,
  MAX_INVENTORY,
} from './constants';
import { RARITIES } from './types';
import type { ShopKey } from './types';
import { computeStats } from './stats';
import {
  makeEnemy,
  enemyKindFor,
  essenceForStage,
  rollRarity,
  isFinalWave,
} from './progression';
import { RELICS, relicDef } from './content/relics';
import { rollItem, itemPower } from './content/items';
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

/** Recompute, then clamp current HP to the new max (e.g. after unequipping +HP). */
export function recomputeClamp(save: GameSave): void {
  recompute(save);
  save.run.hero.hp = Math.min(save.run.hero.hp, save.run.stats.maxHp);
}

function metaLevel(meta: MetaState, id: string): number {
  return meta.nodes[id] ?? 0;
}

function essencePctFromMeta(meta: MetaState): number {
  const def = META_BY_ID['attunement'];
  return (def?.essencePct ?? 0) * metaLevel(meta, 'attunement');
}

function boxLuck(meta: MetaState): number {
  return metaLevel(meta, 'foresight');
}

function randomRelic(rng: Rng): RelicInstance {
  return { id: rng.pick(RELICS).id, rarity: rollRarity(rng) };
}

/** Roll the mystery-box relic: variety-weighted (relics you own fewer copies of
 *  are likelier), rarity biased up by Foresight luck. */
function rollBoxRelic(save: GameSave, rng: Rng): RelicInstance {
  const owned = new Map<string, number>();
  for (const r of save.run.relics) owned.set(r.id, (owned.get(r.id) ?? 0) + 1);
  const weights = RELICS.map((def) => 1 / (1 + (owned.get(def.id) ?? 0)));
  const def = RELICS[rng.weightedIndex(weights)];
  return { id: def.id, rarity: rollRarity(rng, boxLuck(save.meta)) };
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
    shop: { attack: 0, hp: 0, speed: 0 },
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
    dropUid: null,
  };
  // Starting a run above stage 1 (via Head Start) hands you one random relic per
  // skipped stage so you're not thrown in weak — you arrive as if you'd earned them.
  for (let i = 1; i < startStage; i++) run.relics.push(randomRelic(rng));
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
    const cleared = run.stage;
    run.stage += 1;
    run.waveInStage = 0;
    run.bestStageThisRun = Math.max(run.bestStageThisRun, run.stage);
    run.hero.bonusAttackPct += LEVEL_ATTACK_PCT;
    run.hero.bonusMaxHpPct += LEVEL_HP_PCT;
    recompute(save);
    run.hero.hp = run.stats.maxHp; // heal on stage clear
    // A mystery box only drops every Nth cleared stage (relics are rarer but far
    // stronger now); other clears may roll an event, else combat flows straight on.
    // NB: uses the tick's live rng — never re-seed from save.rngState mid-tick.
    if (cleared % RELIC_EVERY_STAGES === 0) {
      run.phase = 'relic';
      run.offer = [rollBoxRelic(save, rng)];
    } else if (rng.next() < EVENT_CHANCE) {
      run.phase = 'event';
      run.eventId = rng.pick(EVENTS).id;
    } else {
      run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng));
    }
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

/** Cap the collection at MAX_INVENTORY, always keeping equipped, the strongest
 *  gear, and the just-dropped item (so its "Loot" line never dangles). */
function pruneInventory(meta: MetaState, protectUid: number): void {
  if (meta.inventory.length <= MAX_INVENTORY) return;
  const keep = new Set<number>([protectUid]);
  for (const uid of Object.values(meta.equipped)) if (uid != null) keep.add(uid);
  for (const it of [...meta.inventory].sort((a, b) => itemPower(b) - itemPower(a))) {
    if (keep.size >= MAX_INVENTORY) break;
    keep.add(it.uid);
  }
  meta.inventory = meta.inventory.filter((it) => keep.has(it.uid));
}

/**
 * End the current run: award essence, drop an item, and enter the 'dead' phase.
 * Takes the caller's `rng` so both death paths (combat + manual rebirth) advance
 * the RNG through the same single stream; the caller owns save.rngState.
 */
export function die(save: GameSave, rng: Rng): void {
  const run = save.run;
  run.phase = 'dead';
  run.hero.hp = 0;
  const gained = essenceForStage(run.bestStageThisRun, essencePctFromMeta(save.meta));
  run.essenceOnDeath = gained;
  save.meta.essence += gained;
  save.meta.bestStage = Math.max(save.meta.bestStage, run.bestStageThisRun);
  save.meta.bestEssence = Math.max(save.meta.bestEssence, save.meta.essence);
  save.meta.totalRebirths += 1;
  // Reward: a permanent item scaled to how far this run reached.
  const item = rollItem(rng, run.bestStageThisRun, save.meta.itemSeq++);
  save.meta.inventory.push(item);
  run.dropUid = item.uid;
  pruneInventory(save.meta, item.uid);
}

/** Manual prestige: bank essence for current progress, then start a fresh run. */
export function rebirth(save: GameSave): void {
  if (save.run.phase !== 'dead') {
    save.run.bestStageThisRun = Math.max(save.run.bestStageThisRun, save.run.stage);
    const rng = new Rng(save.rngState);
    die(save, rng);
    save.rngState = rng.state;
  }
  startRun(save);
}

/** Essence you'd bank by rebirthing right now (for the "when to rebirth" hint). */
export function essenceIfRebirthNow(save: GameSave): number {
  const best = Math.max(save.run.bestStageThisRun, save.run.stage);
  return essenceForStage(best, essencePctFromMeta(save.meta));
}

// --- In-run gold shop (gold sink) ---

export function shopCost(save: GameSave, key: ShopKey): number {
  const lvl = save.run.shop[key];
  return Math.ceil(SHOP_BASE_COST[key] * Math.pow(SHOP_COST_GROWTH, lvl));
}

/** Spend gold on an in-run stat upgrade. Returns true on success. */
export function buyShop(save: GameSave, key: ShopKey): boolean {
  const cost = shopCost(save, key);
  if (save.run.gold < cost) return false;
  save.run.gold -= cost;
  save.run.shop[key] += 1;
  recompute(save);
  return true;
}

const RARITY_RANK = [...RARITIES].reverse(); // legendary..common

/** Index of the highest-rarity relic in the current offer (auto-pick helper). */
export function bestOfferIndex(save: GameSave): number {
  const offer = save.run.offer ?? [];
  let best = 0;
  let bestRank = Infinity;
  offer.forEach((r, i) => {
    const rank = RARITY_RANK.indexOf(r.rarity);
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      best = i;
    }
  });
  return best;
}

export { relicDef };
