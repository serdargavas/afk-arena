import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

export function Hud() {
  // Selective subscriptions: each cell re-renders only when its slice changes.
  const wave = useGameStore((s) => s.wave);
  const dps = useGameStore((s) => s.dps);
  const kills = useGameStore((s) => s.kills);

  return (
    <div className="hud">
      <Cell k="WAVE" v={wave.toString()} />
      <Cell k="DPS" v={formatNum(dps)} />
      <Cell k="KILLS" v={formatNum(kills)} />
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="hud-cell">
      <span className="hud-k">{k}</span>
      <span className="hud-v">{v}</span>
    </div>
  );
}
