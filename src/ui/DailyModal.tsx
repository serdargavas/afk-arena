import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  DAILY_QUESTS,
  DAILY_TARGET,
  MILESTONES,
  STREAK_DAYS,
  dailyPoints,
  questProgress,
} from '../game/content/daily';
import { claimableMilestones, streakClaimable } from '../game';
import { formatNum } from './format';

const STREAK_ICONS = ['💰', '🔮', '💰', '🔮', '💰', '🔮', '🎁'];
const MILESTONE_REWARD = ['💰', '🔮', '💰', '🎁'];

/** Daily hub: forgiving 7-day streak calendar + point-based quests + milestone chests. */
export function DailyModal({ onClose }: { onClose: () => void }) {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const claimMilestone = useGameStore((s) => s.actions.claimDailyMilestone);
  const claimStreak = useGameStore((s) => s.actions.claimStreakDay);
  // quest counters tick outside screenVersion — refresh twice a second while open
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (!save) return null;

  const d = save.meta.daily;
  const dead = save.run.phase === 'dead';
  const pts = dailyPoints(d);
  const claimable = dead ? [] : claimableMilestones(save);
  const streakReady = !dead && streakClaimable(save, Date.now());
  const slot = d.streak % STREAK_DAYS;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sheet daily" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="modal-title">📜 Daily</span>
          <button className="tb-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="panel-label">Login streak</div>
        <div className="streak-row">
          {Array.from({ length: STREAK_DAYS }, (_, i) => {
            const done = i < slot; // only days actually claimed are checked off
            const today = i === slot && streakReady;
            return (
              <button
                key={i}
                className={`streak-day ${done ? 'done' : ''} ${today ? 'today' : ''}`}
                disabled={!today}
                onClick={() => claimStreak()}
              >
                <span className="streak-ico">{done ? '✓' : STREAK_ICONS[i]}</span>
                <span className="streak-num">D{i + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="panel-label">
          Quests · {pts}/{DAILY_TARGET} pts
        </div>
        <div className="daily-bar">
          <div className="daily-bar-fill" style={{ width: `${Math.min(100, (pts / DAILY_TARGET) * 100)}%` }} />
          {MILESTONES.map((m, i) => {
            const ready = claimable.includes(m);
            const taken = d.claimed.includes(m);
            return (
              <button
                key={m}
                className={`daily-chest ${ready ? 'ready' : ''} ${taken ? 'taken' : ''}`}
                style={{ left: `${6 + m * 0.88}%` }} // 25→28% … 100→94%: chests stay inside the bar
                disabled={!ready}
                onClick={() => claimMilestone(m)}
                title={`${m} pts`}
              >
                {taken ? '✓' : MILESTONE_REWARD[i]}
              </button>
            );
          })}
        </div>

        <div className="quest-list">
          {DAILY_QUESTS.map((q) => {
            const prog = questProgress(d, q);
            const done = prog >= q.target;
            const shown = q.id === 'activeSeconds' ? Math.floor(prog / 60) : prog;
            const target = q.id === 'activeSeconds' ? q.target / 60 : q.target;
            return (
              <div key={q.id} className={`quest-row ${done ? 'done' : ''}`}>
                <span className="quest-ico">{q.icon}</span>
                <div className="quest-mid">
                  <span className="quest-name">{q.name}</span>
                  <div className="quest-bar">
                    <div className="quest-bar-fill" style={{ width: `${(prog / q.target) * 100}%` }} />
                  </div>
                </div>
                <span className="quest-prog">
                  {formatNum(shown)}/{formatNum(target)}
                </span>
                <span className={`quest-pts ${done ? 'earned' : ''}`}>{done ? '✓' : ''} {q.points}p</span>
              </div>
            );
          })}
        </div>
        <div className="tree-hint">
          {dead
            ? '💀 Your hero has fallen — rebirth to claim rewards'
            : 'Rewards scale with your stage · the 100pt chest holds a bonus relic'}
        </div>
      </div>
    </div>
  );
}
