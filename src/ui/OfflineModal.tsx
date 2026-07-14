import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { formatNum, formatTime } from './format';

// Welcome-back moment, idle-chest style: your away earnings sit inside a golden
// chest — tap it to burst it open and collect. The best moment of the day.
export function OfflineModal() {
  const report = useGameStore((s) => s.offline);
  const setOffline = useGameStore((s) => s.setOffline);
  const [open, setOpen] = useState(false);
  if (!report) return null;

  return (
    <div className="modal-backdrop box-backdrop" onClick={() => (open ? setOffline(null) : setOpen(true))}>
      {!open ? (
        <div className="mystery-box mb-legendary">
          <div className="box-rays" />
          <div className="box-aura" />
          <div className="chest">
            <div className="chest-lid" />
            <div className="chest-seam" />
            <div className="chest-base" />
            <div className="chest-lock" />
          </div>
          <div className="box-motes">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="box-label">Idle Loot</div>
          <div className="box-tap">away {formatTime(report.seconds)}{report.capped ? ' (12h cap)' : ''} · tap to open</div>
        </div>
      ) : (
        <div className="box-reveal rr-legendary">
          <div className="reveal-beam" />
          <div className="reveal-burst" />
          <div className="reveal-card">
            <span className="reveal-ico">💰</span>
            <span className="reveal-name">+{formatNum(report.goldGained)} gold</span>
            <span className="reveal-desc">
              ⚔ {formatNum(report.kills)} kills · away {formatTime(report.seconds)}
            </span>
            <button className="modal-btn" onClick={() => setOffline(null)}>
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
