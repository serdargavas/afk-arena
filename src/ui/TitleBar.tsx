import { getCurrentWindow } from '@tauri-apps/api/window';
import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

const win = getCurrentWindow();

export function TitleBar() {
  const gold = useGameStore((s) => s.gold);
  const pinned = useGameStore((s) => s.alwaysOnTop);
  const setPinned = useGameStore((s) => s.setAlwaysOnTop);

  const togglePin = async () => {
    const next = !pinned;
    await win.setAlwaysOnTop(next);
    setPinned(next);
  };

  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="tb-title">⚔ AFK Arena</span>
      <span className="tb-gold">◈ {formatNum(gold)}</span>
      <span className="tb-spacer" />
      <button
        className={pinned ? 'tb-btn on' : 'tb-btn'}
        onClick={togglePin}
        title="Always on top"
      >
        📌
      </button>
      <button className="tb-btn" onClick={() => win.minimize()} title="Minimize">
        –
      </button>
      <button className="tb-btn" onClick={() => win.close()} title="Close">
        ✕
      </button>
    </div>
  );
}
