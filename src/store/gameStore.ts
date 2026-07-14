import { create } from 'zustand';
import type { GameSave, UISnapshot, OfflineReport, ClassId, ShopKey, SlotId } from '../game/types';

/** Imperative actions the UI invokes; the loop wires the real implementations. */
export interface GameActions {
  pickRelic: (index: number) => void;
  resolveEvent: (index: number) => void;
  rebirth: () => void;
  buyNode: (id: string) => void;
  buyShop: (key: ShopKey) => void;
  selectClass: (id: ClassId) => void;
  allocateSkill: (id: string) => void;
  respecSkills: () => void;
  equipItem: (uid: number) => void;
  unequipItem: (slot: SlotId) => void;
  setAlwaysOnTop: (v: boolean) => void;
  setOverFullscreen: (v: boolean) => void;
  setAutoRelic: (v: boolean) => void;
  setAutoBuy: (v: boolean) => void;
  setGameSpeed: (n: number) => void;
  setPlayerName: (name: string) => void;
  claimDailyMilestone: (m: number) => void;
  claimStreakDay: () => void;
  markGearSeen: () => void;
}

const NOOP: GameActions = {
  pickRelic: () => {},
  resolveEvent: () => {},
  rebirth: () => {},
  buyNode: () => {},
  buyShop: () => {},
  selectClass: () => {},
  allocateSkill: () => {},
  respecSkills: () => {},
  equipItem: () => {},
  unequipItem: () => {},
  setAlwaysOnTop: () => {},
  setOverFullscreen: () => {},
  setAutoRelic: () => {},
  setAutoBuy: () => {},
  setGameSpeed: () => {},
  setPlayerName: () => {},
  claimDailyMilestone: () => {},
  claimStreakDay: () => {},
  markGearSeen: () => {},
};

const INITIAL: UISnapshot = {
  phase: 'fighting',
  heroClass: 'warrior',
  stage: 1,
  waveInStage: 0,
  biomeName: '',
  gold: 0,
  essence: 0,
  kills: 0,
  dps: 0,
  heroHp: 0,
  heroMaxHp: 0,
  enemyHp: 0,
  enemyMaxHp: 0,
  enemyKind: 'normal',
  relicCount: 0,
  bestStage: 1,
  essenceIfRebirth: 0,
  dailyClaimable: 0,
  badgeMeta: 0,
  badgeSkills: 0,
  badgeGear: 0,
};

interface GameStore extends UISnapshot {
  offline: OfflineReport | null;
  // Bumped whenever screen-level state (offer/event/relics/meta/settings) changes,
  // so modal components re-read the live `save` without per-frame copying.
  screenVersion: number;
  save: GameSave | null;
  actions: GameActions;
  // AFK: while the window is unfocused the scene freezes and we tally gold earned.
  afk: boolean;
  afkGold: number;
  applySnapshot: (s: UISnapshot) => void;
  bumpScreen: () => void;
  setOffline: (r: OfflineReport | null) => void;
  setAfkState: (afk: boolean, afkGold: number) => void;
  attach: (save: GameSave, actions: GameActions) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  ...INITIAL,
  offline: null,
  screenVersion: 0,
  save: null,
  actions: NOOP,
  afk: false,
  afkGold: 0,
  applySnapshot: (s) => set(s),
  bumpScreen: () => set((st) => ({ screenVersion: st.screenVersion + 1 })),
  setOffline: (r) => set({ offline: r }),
  setAfkState: (afk, afkGold) => set({ afk, afkGold }),
  attach: (save, actions) => set({ save, actions }),
}));

// Non-hook accessors for the (non-React) game loop.
export function pushSnapshot(s: UISnapshot): void {
  useGameStore.getState().applySnapshot(s);
}
export function bumpScreen(): void {
  useGameStore.getState().bumpScreen();
}
