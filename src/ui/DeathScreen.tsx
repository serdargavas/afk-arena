import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

export function DeathScreen({ onMeta }: { onMeta: () => void }) {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const rebirth = useGameStore((s) => s.actions.rebirth);
  if (!save) return null;
  const run = save.run;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-title">💀 You Died</div>
        <div className="modal-row">Reached stage {run.bestStageThisRun}</div>
        <div className="modal-row gold">+{formatNum(run.essenceOnDeath)} essence</div>
        <div className="modal-row sub">Total essence: {formatNum(save.meta.essence)}</div>
        <div className="death-btns">
          <button className="modal-btn" onClick={() => rebirth()}>
            New Run
          </button>
          <button className="modal-btn ghost" onClick={onMeta}>
            Meta Tree
          </button>
        </div>
      </div>
    </div>
  );
}
