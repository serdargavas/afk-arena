import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GameLoop } from '../loop';
import { loadRaw, saveRaw } from '../platform/storage';
import { createInitialSave, deserialize, serialize, applyOffline } from '../game';
import { useGameStore } from '../store/gameStore';
import { setAlwaysOnTop, setOverFullscreen } from '../platform/window';
import { isTauri } from '../platform/tauri';
import { TitleBar } from './TitleBar';
import { RunPanel } from './RunPanel';
import { MysteryBox } from './MysteryBox';
import { EventModal } from './EventModal';
import { DeathScreen } from './DeathScreen';
import { RebirthScreen } from './RebirthScreen';
import { Settings } from './Settings';
import { OfflineModal } from './OfflineModal';
import { Leaderboard } from './Leaderboard';
import { ActionBar, type Panel, type SheetTab } from './ActionBar';
import { Scene3D } from '../render3d/Scene3D';
import { SceneOverlays } from './SceneOverlays';
import { leaderboardEnabled, submitScore } from '../net/leaderboard';

const OFFLINE_MODAL_MIN_SECONDS = 30;

function newPlayerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'p' + Math.floor(Math.random() * 1e9).toString(36);
  }
}

export default function App() {
  const loopRef = useRef<GameLoop | null>(null);
  const phase = useGameStore((s) => s.phase);
  const [panel, setPanel] = useState<Panel | null>(null);
  const charTab: SheetTab | null =
    panel === 'meta' || panel === 'skills' || panel === 'gear' ? panel : null;

  // Auto-sync the run's result to the leaderboard when it ends (no-op if signed out).
  useEffect(() => {
    if (phase !== 'dead' || !leaderboardEnabled()) return;
    const s = loopRef.current?.save;
    if (!s) return;
    void submitScore({
      name: s.meta.playerName,
      bestStage: s.meta.bestStage,
      bestEssence: s.meta.bestEssence,
      classId: s.meta.selectedClass,
    }).catch(() => {});
  }, [phase]);

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

      if (disposed) return;

      const loop = new GameLoop(save);
      loopRef.current = loop;
      loop.start();

      if (isTauri()) {
        const win = getCurrentWindow();
        if (save.meta.settings.alwaysOnTop) await setAlwaysOnTop(true);
        if (save.meta.settings.overFullscreen) await setOverFullscreen(true);

        unlisten.push(await win.onFocusChanged(({ payload: focused }) => loop.setFocused(focused)));
        unlisten.push(
          await win.onCloseRequested(async (e) => {
            e.preventDefault();
            await saveRaw(serialize(loop.save));
            await win.destroy();
          }),
        );
      }
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
      <TitleBar />
      <Scene3D />
      <SceneOverlays />
      <ActionBar onOpen={setPanel} />
      <RunPanel />
      {phase === 'relic' && <MysteryBox />}
      {phase === 'event' && <EventModal />}
      {phase === 'dead' && <DeathScreen onMeta={() => setPanel('meta')} />}
      {charTab && <RebirthScreen initialTab={charTab} onClose={() => setPanel(null)} />}
      {panel === 'settings' && <Settings onClose={() => setPanel(null)} />}
      {panel === 'leaderboard' && <Leaderboard onClose={() => setPanel(null)} />}
      <OfflineModal />
    </div>
  );
}
