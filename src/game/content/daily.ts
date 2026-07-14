import type { DailyState, GameSave } from '../types';

// Point-based daily quests (AFK-Arena style): the pool is worth more than the
// 100-point target so players choose which activities make up their day, and
// milestones pay out along the way. Streak is forgiving: missing a day never
// resets it — the calendar simply waits for the next claim.

export interface DailyQuestDef {
  id: keyof Pick<DailyState, 'kills' | 'stages' | 'boxes' | 'rebirths' | 'shopBuys' | 'activeSeconds'>;
  icon: string;
  name: string;
  target: number;
  points: number;
}

export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'kills', icon: '⚔', name: 'Slay 50 fiends', target: 50, points: 25 },
  { id: 'stages', icon: '🏔', name: 'Clear 3 stages', target: 3, points: 25 },
  { id: 'boxes', icon: '🎁', name: 'Open a mystery box', target: 1, points: 20 },
  { id: 'shopBuys', icon: '🛒', name: 'Buy 5 shop upgrades', target: 5, points: 15 },
  { id: 'rebirths', icon: '🔄', name: 'Rebirth once', target: 1, points: 25 },
  { id: 'activeSeconds', icon: '⏱', name: 'Battle for 10 minutes', target: 600, points: 20 },
]; // 130 points available, 100 needed for the final chest

export const DAILY_TARGET = 100;
export const MILESTONES = [25, 50, 75, 100];
export const STREAK_DAYS = 7;

/** Local calendar day for an epoch-ms timestamp. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function freshDaily(day: string): DailyState {
  return {
    day,
    kills: 0,
    stages: 0,
    boxes: 0,
    rebirths: 0,
    shopBuys: 0,
    activeSeconds: 0,
    claimed: [],
    streak: 0,
    lastStreakDay: '',
  };
}

/** Roll counters over to a new local day (streak fields survive). */
export function ensureDaily(save: GameSave, nowMs: number): DailyState {
  const d = save.meta.daily;
  const today = dayKey(nowMs);
  if (d.day !== today) {
    const { streak, lastStreakDay } = d;
    save.meta.daily = { ...freshDaily(today), streak, lastStreakDay };
  }
  return save.meta.daily;
}

/** Increment a quest counter (call sites pass save.lastSeen as "now"). */
export function bumpDaily(save: GameSave, key: DailyQuestDef['id'], n = 1): void {
  const d = ensureDaily(save, save.lastSeen);
  d[key] += n;
}

export function questProgress(d: DailyState, q: DailyQuestDef): number {
  return Math.min(q.target, d[q.id]);
}

/** Points from fully-completed quests. */
export function dailyPoints(d: DailyState): number {
  return DAILY_QUESTS.reduce((sum, q) => sum + (d[q.id] >= q.target ? q.points : 0), 0);
}

export function claimableMilestones(save: GameSave): number[] {
  const d = save.meta.daily;
  const pts = dailyPoints(d);
  return MILESTONES.filter((m) => pts >= m && !d.claimed.includes(m));
}

/** Pure (no rollover side-effect — safe to call from render/snapshot paths). */
export function streakClaimable(save: GameSave, nowMs: number): boolean {
  const today = dayKey(nowMs);
  const d = save.meta.daily;
  if (d.day !== today) return true; // a new day has started (rollover pending)
  return d.lastStreakDay !== today;
}
