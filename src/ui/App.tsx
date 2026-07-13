import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GameLoop } from '../loop';
import { loadRaw, saveRaw } from '../platform/storage';
import { createInitialSave, deserialize, serialize, applyOffline } from '../game';
import { useGameStore } from '../store/gameStore';
import { TitleBar } from './TitleBar';
import { Hud } from './Hud';
import { RelicChoice } from './RelicChoice';
import { EventModal } from './EventModal';
import { DeathScreen } from './DeathScreen';
import { RebirthScreen } from './RebirthScreen';
import { Settings } from './Settings';
import { OfflineModal } from './OfflineModal';

const OFFLINE_MODAL_MIN_SECONDS = 30;

function newPlayerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'p' + Math.floor(Math.random() * 1e9).toString(36);
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const phase = useGameStore((s) => s.phase);
  const [menu, setMenu] = useState<null | 'meta' | 'settings'>(null);

  useEffect(() => {
    let disposed = false;
    const unlisten: Array<() => void> = [];

    (async () => {
      const now = Date.now();
      const raw = await loadRaw();
      const save = (raw && deserialize(raw, now)) || createInitialSave(now);
      if (!save.meta.playerId) save.meta.playerId = newPlayerId();

      const elapsed = Math.max(0, (now - save.lastSeen) / 1000);
      const report = applyOffline(save, elapsed);
      save.lastSeen = now;
      if (report.seconds > OFFLINE_MODAL_MIN_SECONDS && (report.goldGained > 0 || report.kills > 0 || report.died)) {
        useGameStore.getState().setOffline(report);
      }

      if (disposed || !canvasRef.current) return;

      const loop = new GameLoop(save, canvasRef.current);
      loopRef.current = loop;
      loop.start();

      const win = getCurrentWindow();
      try {
        if (save.meta.settings.alwaysOnTop) await win.setAlwaysOnTop(true);
        if (save.meta.settings.overFullscreen) {
          await win.setVisibleOnAllWorkspaces(true);
          await win.setAlwaysOnTop(true);
        }
      } catch (e) {
        console.error('[window] applying settings failed', e);
      }

      unlisten.push(await win.onFocusChanged(({ payload: focused }) => loop.setFocused(focused)));
      unlisten.push(
        await win.onCloseRequested(async (e) => {
          e.preventDefault();
          await saveRaw(serialize(loop.save));
          await win.destroy();
        }),
      );
    })();

    return () => {
      disposed = true;
      unlisten.forEach((u) => u());
      const loop = loopRef.current;
      if (loop) {
        loop.stop();
        void saveRaw(serialize(loop.save));
      }
    };
  }, []);

  return (
    <div className="app">
      <TitleBar onMenu={() => setMenu('meta')} onSettings={() => setMenu('settings')} />
      <canvas ref={canvasRef} className="scene" />
      <Hud />
      {phase === 'relic' && <RelicChoice />}
      {phase === 'event' && <EventModal />}
      {phase === 'dead' && <DeathScreen onMeta={() => setMenu('meta')} />}
      {menu === 'meta' && <RebirthScreen onClose={() => setMenu(null)} />}
      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      <OfflineModal />
    </div>
  );
}
