import { useGameStore } from '../store/gameStore';
import { formatNum, formatTime } from './format';

export function OfflineModal() {
  const report = useGameStore((s) => s.offline);
  const setOffline = useGameStore((s) => s.setOffline);
  if (!report) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOffline(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Welcome back!</div>
        <div className="modal-row">
          Away {formatTime(report.seconds)}
          {report.capped ? ' (capped)' : ''}
        </div>
        <div className="modal-row gold">+{formatNum(report.goldGained)} gold</div>
        <div className="modal-row sub">
          +{formatNum(report.kills)} kills · {report.stagesCleared} stages · {report.relicsGained} relics
        </div>
        {report.died && <div className="modal-row danger-text">Your hero fell — a new run awaits.</div>}
        <button className="modal-btn" onClick={() => setOffline(null)}>
          Collect
        </button>
      </div>
    </div>
  );
}
