import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

export function Hud() {
  const stage = useGameStore((s) => s.stage);
  const biome = useGameStore((s) => s.biomeName);
  const dps = useGameStore((s) => s.dps);
  const essence = useGameStore((s) => s.essence);
  const relics = useGameStore((s) => s.relicCount);

  return (
    <div className="hud">
      <Cell k="STAGE" v={`${stage}`} sub={biome} />
      <Cell k="DPS" v={formatNum(dps)} />
      <Cell k="RELICS" v={`${relics}`} />
      <Cell k="ESSENCE" v={formatNum(essence)} />
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="hud-cell" title={sub}>
      <span className="hud-k">{k}</span>
      <span className="hud-v">{v}</span>
    </div>
  );
}
