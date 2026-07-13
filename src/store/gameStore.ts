import { create } from 'zustand';
import type { UISnapshot, OfflineReport } from '../game/types';

interface GameStore extends UISnapshot {
  offline: OfflineReport | null;
  alwaysOnTop: boolean;
  pushSnapshot: (s: UISnapshot) => void;
  setOffline: (r: OfflineReport | null) => void;
  setAlwaysOnTop: (v: boolean) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gold: 0,
  wave: 1,
  kills: 0,
  dps: 0,
  enemyHp: 0,
  enemyMaxHp: 0,
  offline: null,
  alwaysOnTop: false,
  pushSnapshot: (s) => set(s),
  setOffline: (r) => set({ offline: r }),
  setAlwaysOnTop: (v) => set({ alwaysOnTop: v }),
}));

/** Non-hook accessor so the (non-React) game loop can push updates. */
export function pushSnapshot(s: UISnapshot): void {
  useGameStore.getState().pushSnapshot(s);
}
