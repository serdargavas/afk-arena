import { describe, it, expect } from 'vitest';
import { createInitialSave } from './save';
import { stepSim } from './combat';
import { claimDailyMilestone, claimStreakDay } from './run';
import { ensureDaily, bumpDaily, dailyPoints, dayKey, DAILY_QUESTS } from './content/daily';
import { SPAWN_GRACE, TICK_DT } from './constants';

const DAY_MS = 24 * 3600 * 1000;

describe('daily quests', () => {
  it('rolls counters over on a new day but keeps the streak', () => {
    const save = createInitialSave(0);
    save.meta.daily.kills = 30;
    save.meta.daily.streak = 4;
    save.meta.daily.lastStreakDay = dayKey(0);
    save.lastSeen = DAY_MS * 2; // two days later
    ensureDaily(save, save.lastSeen);
    expect(save.meta.daily.kills).toBe(0);
    expect(save.meta.daily.claimed).toEqual([]);
    expect(save.meta.daily.streak).toBe(4); // forgiving: missed days never reset
  });

  it('awards milestone rewards once and only when earned', () => {
    const save = createInitialSave(0);
    expect(claimDailyMilestone(save, 25)).toBe(false); // nothing earned yet
    // complete kills + stages quests → 50 points
    bumpDaily(save, 'kills', 50);
    bumpDaily(save, 'stages', 3);
    expect(dailyPoints(save.meta.daily)).toBe(50);
    const goldBefore = save.run.gold;
    expect(claimDailyMilestone(save, 25)).toBe(true);
    expect(save.run.gold).toBeGreaterThan(goldBefore);
    expect(claimDailyMilestone(save, 25)).toBe(false); // no double-claim
    const essBefore = save.meta.essence;
    expect(claimDailyMilestone(save, 50)).toBe(true);
    expect(save.meta.essence).toBeGreaterThan(essBefore);
    expect(claimDailyMilestone(save, 100)).toBe(false); // not earned
  });

  it('quest pool exceeds the 100-point target (players choose their path)', () => {
    const total = DAILY_QUESTS.reduce((s, q) => s + q.points, 0);
    expect(total).toBeGreaterThan(100);
  });

  it('streak claims once per day and advances the calendar', () => {
    const save = createInitialSave(0);
    expect(claimStreakDay(save)).toBe(true);
    expect(save.meta.daily.streak).toBe(1);
    expect(claimStreakDay(save)).toBe(false); // already claimed today
    save.lastSeen = DAY_MS * 3;
    ensureDaily(save, save.lastSeen);
    expect(claimStreakDay(save)).toBe(true); // days later — streak continues
    expect(save.meta.daily.streak).toBe(2);
  });
});

describe('daily counter wiring', () => {
  it('kill quest progresses from real combat kills', () => {
    const save = createInitialSave(0);
    save.run.stats.attack = 1e9; // one-shot
    let guard = 0;
    while (save.meta.daily.kills < 3 && guard++ < 5000) {
      if (save.run.phase !== 'fighting') break;
      stepSim(save);
    }
    expect(save.meta.daily.kills).toBeGreaterThanOrEqual(3);
  });
});

describe('spawn grace', () => {
  it('holds fire while the next enemy walks in', () => {
    const save = createInitialSave(0);
    save.run.spawnGrace = SPAWN_GRACE;
    const heroHp = save.run.hero.hp;
    const enemyHp = save.run.enemy.hp;
    const e = stepSim(save);
    expect(e.hit).toBeUndefined();
    expect(e.hurt).toBeUndefined();
    expect(save.run.hero.hp).toBe(heroHp);
    expect(save.run.enemy.hp).toBe(enemyHp);
    expect(save.run.spawnGrace).toBeCloseTo(SPAWN_GRACE - TICK_DT);
  });
});

describe('dead-phase claim lock', () => {
  it('refuses milestone and streak claims while the hero is down', () => {
    const save = createInitialSave(0);
    bumpDaily(save, 'kills', 50);
    bumpDaily(save, 'stages', 3); // 50 points — milestone 25 would be claimable
    save.run.phase = 'dead';
    const gold = save.run.gold;
    const essence = save.meta.essence;
    expect(claimDailyMilestone(save, 25)).toBe(false);
    expect(claimStreakDay(save)).toBe(false);
    expect(save.run.gold).toBe(gold);
    expect(save.meta.essence).toBe(essence);
    expect(save.meta.daily.claimed).toEqual([]);
    expect(save.meta.daily.streak).toBe(0);
  });
});
