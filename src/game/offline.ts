import { MAX_OFFLINE_SECONDS, MAX_OFFLINE_ITERS } from './constants';
import { heroDps, spawnEnemy } from './economy';
import type { GameState, OfflineReport } from './types';

/**
 * Analytic / loop-capped catch-up for time spent away (app closed, minimized,
 * or a long stall). Instead of stepping every 100ms tick, it clears whole
 * enemies in O(waves): time-to-kill = enemyHp / expectedDps. Bounded by both a
 * time cap (MAX_OFFLINE_SECONDS) and an iteration cap (MAX_OFFLINE_ITERS).
 *
 * Mutates `state` in place and returns a report for the "welcome back" modal.
 */
export function applyOffline(state: GameState, elapsedSeconds: number): OfflineReport {
  const capped = elapsedSeconds > MAX_OFFLINE_SECONDS;
  const budget = Math.min(Math.max(0, elapsedSeconds), MAX_OFFLINE_SECONDS);
  let remaining = budget;

  const dps = heroDps(state.hero);
  let goldGained = 0;
  let kills = 0;
  let wavesCleared = 0;

  if (dps > 0) {
    for (let iters = 0; remaining > 0 && iters < MAX_OFFLINE_ITERS; iters++) {
      const timeToKill = state.enemy.hp / dps;
      if (timeToKill > remaining) {
        // Not enough time to finish the current enemy — chip its HP and stop.
        state.enemy.hp -= dps * remaining;
        remaining = 0;
        break;
      }
      remaining -= timeToKill;
      goldGained += state.enemy.goldReward;
      kills += 1;
      wavesCleared += 1;
      state.gold += state.enemy.goldReward;
      state.kills += 1;
      state.wave += 1;
      state.enemy = spawnEnemy(state.wave);
    }
  }

  return { seconds: budget, goldGained, kills, wavesCleared, capped };
}
