import { getCurrentWindow } from '@tauri-apps/api/window';
import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

// Lazily reach the window inside handlers so importing this module never runs
// getCurrentWindow() (which throws outside Tauri, e.g. in a browser preview).
function win(fn: (w: ReturnType<typeof getCurrentWindow>) => void) {
  try {
    fn(getCurrentWindow());
  } catch (e) {
    console.error('[window]', e);
  }
}

export function TitleBar() {
  const gold = useGameStore((s) => s.gold);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="tb-title">⚔</span>
      <span className="tb-gold">◈ {formatNum(gold)}</span>
      <span className="tb-spacer" />
      <button className="tb-btn" onClick={() => win((w) => w.minimize())} title="Minimize">
        –
      </button>
      <button className="tb-btn" onClick={() => win((w) => w.close())} title="Close">
        ✕
      </button>
    </div>
  );
}
