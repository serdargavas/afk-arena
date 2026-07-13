import { TICK_DT, MAX_OFFLINE_SECONDS, MAX_OFFLINE_ITERS } from './constants';
import { stepSim } from './combat';
import { pickRelic, resolveEvent, bestOfferIndex } from './run';
import type { GameSave, OfflineReport, RunPhase } from './types';

/**
 * Catch up for time spent away (closed / minimized / stalled). Replays the real
 * combat step so offline progress is exactly consistent with live play, but
 * auto-picks relics/events and is bounded by both a time budget and an
 * iteration cap. Stops at death (the player returns to the death screen).
 */
export function applyOffline(save: GameSave, elapsedSeconds: number): OfflineReport {
  const empty: OfflineReport = {
    seconds: 0,
    goldGained: 0,
    kills: 0,
    stagesCleared: 0,
    relicsGained: 0,
    died: save.run.phase === 'dead',
    capped: false,
  };
  // Only progress from an active fight. If the player closed on a relic/event
  // choice (or a death screen), present that on reopen instead of auto-resolving.
  if (save.run.phase !== 'fighting') return empty;

  const capped = elapsedSeconds > MAX_OFFLINE_SECONDS;
  const budget = Math.min(Math.max(0, elapsedSeconds), MAX_OFFLINE_SECONDS);

  const startGold = save.run.gold;
  const startKills = save.run.kills;
  const startStage = save.run.stage;
  const startRelics = save.run.relics.length;

  let simulated = 0;
  let iters = 0;
  let died = false; // guaranteed 'fighting' at this point

  while (simulated < budget && iters < MAX_OFFLINE_ITERS && !died) {
    iters++;
    // Read into a local so TS doesn't narrow save.run.phase across the mutating
    // stepSim call (the phase can flip to 'dead' inside it).
    const phase: RunPhase = save.run.phase;
    if (phase === 'fighting') {
      stepSim(save);
      simulated += TICK_DT;
      if ((save.run.phase as RunPhase) === 'dead') died = true;
    } else if (phase === 'relic') {
      pickRelic(save, bestOfferIndex(save));
    } else if (phase === 'event') {
      resolveEvent(save, 0);
    } else {
      died = true;
    }
  }

  return {
    seconds: budget,
    goldGained: Math.max(0, save.run.gold - startGold),
    kills: Math.max(0, save.run.kills - startKills),
    stagesCleared: Math.max(0, save.run.stage - startStage),
    relicsGained: Math.max(0, save.run.relics.length - startRelics),
    died,
    capped,
  };
}
