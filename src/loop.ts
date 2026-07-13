import {
  TICK_DT,
  TICK_DT_MS,
  MAX_STEPS_PER_FRAME,
  BULK_CATCHUP_THRESHOLD_MS,
  STORE_PUSH_INTERVAL_MS,
  AUTOSAVE_INTERVAL_MS,
  AUTO_RELIC_DELAY_MS,
} from './game/constants';
import { stepSim, type TickEvents } from './game/combat';
import { applyOffline } from './game/offline';
import { serialize } from './game/save';
import {
  pickRelic,
  resolveEvent,
  rebirth,
  buyShop,
  shopCost,
  bestOfferIndex,
  essenceIfRebirthNow,
  recomputeClamp,
} from './game/run';
import {
  buyNode,
  selectClass,
  allocateSkill,
  respecSkills,
  equipItem,
  unequipItem,
} from './game/meta';
import { expectedDps } from './game/stats';
import { biomeName } from './game/progression';
import type { GameSave, UISnapshot, ClassId, ShopKey, SlotId } from './game/types';
import { combatBus } from './render3d/bus';
import { pushSnapshot, bumpScreen, useGameStore, type GameActions } from './store/gameStore';
import { saveRaw } from './platform/storage';

function snapshotOf(save: GameSave): UISnapshot {
  const run = save.run;
  return {
    phase: run.phase,
    heroClass: run.hero.classId,
    stage: run.stage,
    waveInStage: run.waveInStage,
    biomeName: biomeName(run.stage),
    gold: Math.floor(run.gold),
    essence: Math.floor(save.meta.essence),
    kills: run.kills,
    dps: Math.round(expectedDps(run.stats)),
    heroHp: Math.max(0, Math.ceil(run.hero.hp)),
    heroMaxHp: run.stats.maxHp,
    enemyHp: Math.max(0, Math.ceil(run.enemy.hp)),
    enemyMaxHp: run.enemy.maxHp,
    enemyKind: run.enemy.kind,
    relicCount: run.relics.length,
    bestStage: save.meta.bestStage,
    essenceIfRebirth: essenceIfRebirthNow(save),
  };
}

/** Cheap fingerprint of screen-level state; when it changes, modals re-read. */
function screenKeyOf(save: GameSave): string {
  const r = save.run;
  const m = save.meta;
  const offer = r.offer ? r.offer.map((o) => o.id + o.rarity).join(',') : '-';
  const nodes = Object.entries(m.nodes)
    .map(([k, v]) => k + v)
    .join(',');
  return [
    r.phase,
    offer,
    r.eventId ?? '-',
    r.essenceOnDeath,
    r.relics.length,
    m.essence,
    m.selectedClass,
    m.unlockedClasses.join('|'),
    nodes,
    m.settings.alwaysOnTop ? 1 : 0,
    m.settings.overFullscreen ? 1 : 0,
    m.settings.autoRelic ? 1 : 0,
    m.settings.autoBuy ? 1 : 0,
    m.settings.gameSpeed,
    `${r.shop.attack}.${r.shop.hp}.${r.shop.speed}`,
    m.playerName,
  ].join('~');
}

export class GameLoop {
  readonly save: GameSave;

  private acc = 0;
  private simTime = 0;
  private focused = true;
  private running = false;
  private rafId = 0;

  private lastStorePush = 0;
  private lastAutosave = 0;
  private lastScreenKey = '';
  private relicSince = 0; // when the current relic offer appeared (auto-relic timer)
  private afk = false; // window unfocused → scene freezes, we tally idle earnings
  private afkGold = 0;
  private afkLastGold = 0;

  // Render-agnostic: the loop advances the sim + store and emits combat juice to
  // combatBus; the R3F scene (or any renderer) draws by reading the store + bus.
  constructor(save: GameSave) {
    this.save = save;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const now = Date.now();
    this.save.lastSeen = now;
    this.lastStorePush = now;
    this.lastAutosave = now;
    useGameStore.getState().attach(this.save, this.buildActions());
    this.syncStore(true);
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setFocused(f: boolean): void {
    if (this.focused === f) return;
    this.focused = f;
    if (!f) {
      // going AFK: start tallying gold earned while away
      this.afk = true;
      this.afkGold = 0;
      this.afkLastGold = this.save.run.gold;
    } else {
      this.afk = false;
    }
    useGameStore.getState().setAfkState(this.afk, Math.floor(this.afkGold));
  }

  private frame = (): void => {
    if (!this.running) return;
    const now = Date.now();
    const realDelta = now - this.save.lastSeen;
    this.save.lastSeen = now;

    if (this.save.run.phase === 'fighting') {
      if (realDelta > BULK_CATCHUP_THRESHOLD_MS) {
        // Long stall / minimize / sleep — fold in analytically (auto-plays relics).
        applyOffline(this.save, realDelta / 1000);
        this.acc = 0;
      } else if (realDelta > 0) {
        // game-speed multiplier (1×/2×/3×) scales how much sim-time each frame banks
        this.acc += realDelta * (this.save.meta.settings.gameSpeed || 1);
      }
      let steps = 0;
      while (this.acc >= TICK_DT_MS && steps < MAX_STEPS_PER_FRAME && this.save.run.phase === 'fighting') {
        this.emit(stepSim(this.save));
        this.acc -= TICK_DT_MS;
        this.simTime += TICK_DT;
        steps++;
      }
      if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0;
      if (this.save.meta.settings.autoBuy) this.autoSpend();
    } else {
      // Paused on a relic/event/death screen — don't bank real time as combat.
      this.acc = 0;
    }

    // Auto-pick: after AUTO_RELIC_DELAY_MS, auto-resolve relic offers AND events.
    const p = this.save.run.phase;
    if ((p === 'relic' || p === 'event') && this.save.meta.settings.autoRelic) {
      if (this.relicSince === 0) this.relicSince = now;
      else if (now - this.relicSince >= AUTO_RELIC_DELAY_MS) {
        this.relicSince = 0;
        if (this.save.run.phase === 'relic') {
          this.act(() => pickRelic(this.save, bestOfferIndex(this.save)));
        } else {
          this.act(() => resolveEvent(this.save, 0));
        }
      }
    } else if (p !== 'relic' && p !== 'event') {
      this.relicSince = 0;
    }

    // Tally gold earned while AFK (ignore spends, so it reads as gross income).
    if (this.afk) {
      const g = this.save.run.gold;
      if (g > this.afkLastGold) this.afkGold += g - this.afkLastGold;
      this.afkLastGold = g;
    }

    if (now - this.lastStorePush >= STORE_PUSH_INTERVAL_MS) {
      this.syncStore(false);
      if (this.afk) useGameStore.getState().setAfkState(true, Math.floor(this.afkGold));
      this.lastStorePush = now;
    }

    if (now - this.lastAutosave >= AUTOSAVE_INTERVAL_MS) {
      this.lastAutosave = now;
      void saveRaw(serialize(this.save));
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  private syncStore(force: boolean): void {
    pushSnapshot(snapshotOf(this.save));
    const key = screenKeyOf(this.save);
    if (force || key !== this.lastScreenKey) {
      this.lastScreenKey = key;
      bumpScreen();
    }
  }

  private emit(events: TickEvents): void {
    if (!this.focused) return;
    if (events.hit) combatBus.emit('hit', events.hit);
    if (events.hurt) combatBus.emit('hurt', events.hurt);
    if (events.kill) combatBus.emit('kill', events.kill);
  }

  /** Auto-buy: greedily buy the cheapest affordable shop upgrade until broke. */
  private autoSpend(): void {
    const keys: ShopKey[] = ['attack', 'hp', 'speed'];
    for (let n = 0; n < 24; n++) {
      let best: ShopKey | null = null;
      let bestCost = Infinity;
      for (const k of keys) {
        const c = shopCost(this.save, k);
        if (c <= this.save.run.gold && c < bestCost) {
          best = k;
          bestCost = c;
        }
      }
      if (!best) break;
      buyShop(this.save, best);
    }
  }

  /** Run an action that mutates the save, then immediately re-sync + persist. */
  private act(fn: () => void): void {
    fn();
    this.syncStore(true);
    void saveRaw(serialize(this.save));
  }

  private buildActions(): GameActions {
    return {
      pickRelic: (i) => this.act(() => pickRelic(this.save, i)),
      resolveEvent: (i) => this.act(() => resolveEvent(this.save, i)),
      rebirth: () => this.act(() => rebirth(this.save)),
      buyNode: (id) => this.act(() => buyNode(this.save, id)),
      buyShop: (key: ShopKey) => this.act(() => buyShop(this.save, key)),
      selectClass: (id: ClassId) => this.act(() => selectClass(this.save, id)),
      allocateSkill: (id: string) => this.act(() => { allocateSkill(this.save, id); recomputeClamp(this.save); }),
      respecSkills: () => this.act(() => { respecSkills(this.save); recomputeClamp(this.save); }),
      equipItem: (uid: number) => this.act(() => { equipItem(this.save, uid); recomputeClamp(this.save); }),
      unequipItem: (slot: SlotId) => this.act(() => { unequipItem(this.save, slot); recomputeClamp(this.save); }),
      setAlwaysOnTop: (v) => this.act(() => { this.save.meta.settings.alwaysOnTop = v; }),
      setOverFullscreen: (v) => this.act(() => { this.save.meta.settings.overFullscreen = v; }),
      setAutoRelic: (v) => this.act(() => { this.save.meta.settings.autoRelic = v; }),
      setAutoBuy: (v) => this.act(() => { this.save.meta.settings.autoBuy = v; }),
      setGameSpeed: (n) => this.act(() => { this.save.meta.settings.gameSpeed = [1, 2, 3].includes(n) ? n : 1; }),
      setPlayerName: (name) => this.act(() => { this.save.meta.playerName = name.slice(0, 24); }),
    };
  }
}
