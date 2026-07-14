import {
  RELIC_EVERY_STAGES,
  LEVEL_ATTACK_PCT,
  LEVEL_HP_PCT,
  EVENT_CHANCE,
  SHOP_BASE_COST,
  SHOP_COST_GROWTH,
  MAX_INVENTORY,
  SPAWN_GRACE,
  PITY_BOX_GUARANTEE,
} from './constants';
import { bumpDaily, dailyPoints, claimableMilestones, ensureDaily, streakClaimable, STREAK_DAYS } from './content/daily';
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
  return metaLevel(meta, 'foresight') * (META_BY_ID['foresight']?.extraRelicChoice ?? 1);
}

function randomRelic(rng: Rng): RelicInstance {
  return { id: rng.pick(RELICS).id, rarity: rollRarity(rng) };
}

/** Log a relic into the permanent codex (best rarity per relic ever obtained). */
export function recordRelic(save: GameSave, r: RelicInstance): void {
  const idx = RARITIES.indexOf(r.rarity);
  const prev = save.meta.codex[r.id];
  if (prev === undefined || idx > prev) save.meta.codex[r.id] = idx;
}

/** Roll the mystery-box relic: variety-weighted (relics you own fewer copies of
 *  are likelier), rarity biased up by Foresight luck. */
function rollBoxRelic(save: GameSave, rng: Rng): RelicInstance {
  const owned = new Map<string, number>();
  for (const r of save.run.relics) owned.set(r.id, (owned.get(r.id) ?? 0) + 1);
  const weights = RELICS.map((def) => 1 / (1 + (owned.get(def.id) ?? 0)));
  const def = RELICS[rng.weightedIndex(weights)];
  let rarity = rollRarity(rng, boxLuck(save.meta));
  // Pity: every PITY_BOX_GUARANTEE-th box is epic or better, guaranteed.
  const epicIdx = RARITIES.indexOf('epic');
  if (save.meta.pity >= PITY_BOX_GUARANTEE - 1 && RARITIES.indexOf(rarity) < epicIdx) {
    rarity = 'epic';
  }
  save.meta.pity = RARITIES.indexOf(rarity) >= epicIdx ? 0 : save.meta.pity + 1;
  return { id: def.id, rarity };
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
    spawnGrace: 0,
  };
  // Starting a run above stage 1 (via Head Start) hands you one random relic per
  // skipped stage so you're not thrown in weak — you arrive as if you'd earned them.
  for (let i = 1; i < startStage; i++) {
    const bonus = randomRelic(rng);
    run.relics.push(bonus);
    recordRelic(save, bonus);
  }
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
    bumpDaily(save, 'stages');
    if (cleared % RELIC_EVERY_STAGES === 0) {
      run.phase = 'relic';
      run.offer = [rollBoxRelic(save, rng)];
    } else if (rng.next() < EVENT_CHANCE) {
      run.phase = 'event';
      run.eventId = rng.pick(EVENTS).id;
    } else {
      run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng));
      run.spawnGrace = SPAWN_GRACE;
    }
    return true;
  }
  run.waveInStage += 1;
  run.enemy = makeEnemy(run.stage, enemyKindFor(run.stage, run.waveInStage, rng));
  run.spawnGrace = SPAWN_GRACE;
  return false;
}

/** Player (or offline auto-picker) selects a relic from the pending offer. */
export function pickRelic(save: GameSave, index: number): void {
  const run = save.run;
  if (run.phase !== 'relic' || !run.offer) return;
  const chosen = run.offer[index] ?? run.offer[0];
  if (chosen) {
    run.relics.push(chosen);
    recordRelic(save, chosen);
  }
  bumpDaily(save, 'boxes');
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
    run.spawnGrace = SPAWN_GRACE;
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
      const granted = randomRelic(rng);
      s.run.relics.push(granted);
      recordRelic(s, granted);
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
  run.spawnGrace = SPAWN_GRACE;
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
  bumpDaily(save, 'rebirths');
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
  bumpDaily(save, 'shopBuys');
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

// --- Daily milestone + streak claims (called outside the tick; rngState is authoritative) ---

function stageGold(save: GameSave, mult: number): number {
  return Math.ceil(makeEnemy(Math.max(save.run.stage, 1), 'normal').goldReward * mult);
}

function essenceReward(save: GameSave, frac: number): number {
  const best = Math.max(save.meta.bestStage, save.run.stage);
  return Math.max(1, Math.floor(essenceForStage(best, 0) * frac));
}

/** Claim a daily quest milestone (25/50/75/100 points). Returns true on success. */
export function claimDailyMilestone(save: GameSave, milestone: number): boolean {
  if (save.run.phase === 'dead') return false; // rewards would die with the run
  const d = ensureDaily(save, save.lastSeen);
  if (!claimableMilestones(save).includes(milestone)) return false;
  d.claimed.push(milestone);
  const rng = new Rng(save.rngState);
  if (milestone === 25) save.run.gold += stageGold(save, 25);
  else if (milestone === 50) save.meta.essence += essenceReward(save, 0.1);
  else if (milestone === 75) save.run.gold += stageGold(save, 60);
  else {
    // 100: a bonus relic joins the current run, luck-boosted
    const bonus: RelicInstance = { id: rng.pick(RELICS).id, rarity: rollRarity(rng, 1) };
    save.run.relics.push(bonus);
    recordRelic(save, bonus);
    recompute(save);
  }
  save.rngState = rng.state;
  save.meta.bestEssence = Math.max(save.meta.bestEssence, save.meta.essence);
  return true;
}

/** Claim today's streak chest (forgiving: missed days never reset the calendar). */
export function claimStreakDay(save: GameSave): boolean {
  if (save.run.phase === 'dead') return false;
  ensureDaily(save, save.lastSeen); // roll the day over before judging the claim
  if (!streakClaimable(save, save.lastSeen)) return false;
  const d = save.meta.daily;
  const slot = d.streak % STREAK_DAYS; // 0..6
  const rng = new Rng(save.rngState);
  if (slot === 0) save.run.gold += stageGold(save, 20);
  else if (slot === 1) save.meta.essence += essenceReward(save, 0.05);
  else if (slot === 2) save.run.gold += stageGold(save, 40);
  else if (slot === 3) save.meta.essence += essenceReward(save, 0.08);
  else if (slot === 4) save.run.gold += stageGold(save, 60);
  else if (slot === 5) save.meta.essence += essenceReward(save, 0.1);
  else {
    const bonus: RelicInstance = { id: rng.pick(RELICS).id, rarity: rollRarity(rng, 2) };
    save.run.relics.push(bonus);
    recordRelic(save, bonus);
    save.run.gold += stageGold(save, 80);
    recompute(save);
  }
  save.rngState = rng.state;
  d.streak += 1;
  d.lastStreakDay = d.day;
  save.meta.bestEssence = Math.max(save.meta.bestEssence, save.meta.essence);
  return true;
}

export { relicDef, dailyPoints, claimableMilestones, streakClaimable };
