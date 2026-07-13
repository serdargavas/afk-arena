import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

export function OfflineModal() {
  const report = useGameStore((s) => s.offline);
  const setOffline = useGameStore((s) => s.setOffline);
  if (!report) return null;

  const h = Math.floor(report.seconds / 3600);
  const m = Math.floor((report.seconds % 3600) / 60);
  const away = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="modal-backdrop" onClick={() => setOffline(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Welcome back!</div>
        <div className="modal-row">
          Away {away}
          {report.capped ? ' (capped)' : ''}
        </div>
        <div className="modal-row gold">+{formatNum(report.goldGained)} gold</div>
        <div className="modal-row sub">
          +{formatNum(report.kills)} kills · {formatNum(report.wavesCleared)} waves
        </div>
        <button className="modal-btn" onClick={() => setOffline(null)}>
          Collect
        </button>
      </div>
    </div>
  );
}
