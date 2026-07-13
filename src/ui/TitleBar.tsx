import { getCurrentWindow } from '@tauri-apps/api/window';
import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

const win = getCurrentWindow();

export function TitleBar({ onMenu, onSettings }: { onMenu: () => void; onSettings: () => void }) {
  const gold = useGameStore((s) => s.gold);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="tb-title">⚔</span>
      <span className="tb-gold">◈ {formatNum(gold)}</span>
      <span className="tb-spacer" />
      <button className="tb-btn" onClick={onMenu} title="Meta / Rebirth">
        🌳
      </button>
      <button className="tb-btn" onClick={onSettings} title="Settings">
        ⚙
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
