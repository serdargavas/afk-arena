import { TICK_DT } from './constants';
import { nextRandom } from './rng';
import { spawnEnemy } from './economy';
import type { GameState } from './types';

/** Render-relevant things that happened during a tick (drive particles). */
export interface TickEvents {
  hit?: { damage: number; crit: boolean };
  kill?: { gold: number; wave: number };
}

/**
 * Advance the simulation by exactly one fixed tick (TICK_DT seconds).
 * Deterministic given (state, rngState). Mutates `state` in place and returns
 * the events the renderer should react to.
 */
export function stepSim(state: GameState): TickEvents {
  const events: TickEvents = {};
  const hero = state.hero;

  // decay hit-flash (render juice)
  if (state.enemy.flash > 0) {
    state.enemy.flash = Math.max(0, state.enemy.flash - TICK_DT);
  }

  hero.cooldown -= TICK_DT;

  // Resolve as many attacks as fit in this tick (handles very high attack speed).
  while (hero.cooldown <= 0 && state.enemy.hp > 0) {
    const roll = nextRandom(state.rngState);
    state.rngState = roll.state;
    const crit = roll.value < hero.critChance;
    const damage = crit ? Math.round(hero.attack * hero.critMult) : hero.attack;

    state.enemy.hp -= damage;
    state.enemy.flash = 0.12;
    events.hit = { damage, crit };
    hero.cooldown += 1 / hero.attackSpeed;

    if (state.enemy.hp <= 0) {
      state.gold += state.enemy.goldReward;
      state.kills += 1;
      state.wave += 1;
      events.kill = { gold: state.enemy.goldReward, wave: state.wave - 1 };
      state.enemy = spawnEnemy(state.wave);
      break; // remaining cooldown budget carries to the next enemy
    }
  }

  return events;
}
