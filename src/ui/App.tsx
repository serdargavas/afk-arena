import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GameLoop } from '../loop';
import { loadRaw, saveRaw } from '../platform/storage';
import { createInitialState, deserialize, serialize, applyOffline } from '../game';
import { useGameStore } from '../store/gameStore';
import { TitleBar } from './TitleBar';
import { Hud } from './Hud';
import { OfflineModal } from './OfflineModal';

const OFFLINE_MODAL_MIN_SECONDS = 30; // don't nag for trivial absences

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    (async () => {
      const now = Date.now();
      const raw = await loadRaw();
      const state = (raw && deserialize(raw, now)) || createInitialState(now);

      // Offline catch-up for time since the last save.
      const elapsed = Math.max(0, (now - state.lastSeen) / 1000);
      const report = applyOffline(state, elapsed);
      state.lastSeen = now;
      if (report.seconds > OFFLINE_MODAL_MIN_SECONDS && report.goldGained > 0) {
        useGameStore.getState().setOffline(report);
      }

      if (disposed || !canvasRef.current) return;

      const loop = new GameLoop(state, canvasRef.current);
      loopRef.current = loop;
      loop.start();

      const win = getCurrentWindow();
      unlisteners.push(
        await win.onFocusChanged(({ payload: focused }) => loop.setFocused(focused)),
      );
      unlisteners.push(
        await win.onCloseRequested(async (e) => {
          e.preventDefault();
          await saveRaw(serialize(loop.state));
          await win.destroy();
        }),
      );
    })();

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
      const loop = loopRef.current;
      if (loop) {
        loop.stop();
        void saveRaw(serialize(loop.state));
      }
    };
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <canvas ref={canvasRef} className="scene" />
      <Hud />
      <OfflineModal />
    </div>
  );
}
