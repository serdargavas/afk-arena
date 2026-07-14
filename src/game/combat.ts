import { TICK_DT, MAX_ATTACKS_PER_TICK, MISS_CHANCE, DMG_VARIANCE, SPAWN_GRACE } from './constants';
import { Rng } from './rng';
import { advanceWave, die } from './run';
import { bumpDaily } from './content/daily';
import { makeEnemy } from './progression';
import type { GameSave } from './types';

/** Render-relevant things that happened during a tick (drive particles/juice). */
export interface TickEvents {
  hit?: { damage: number; crit: boolean; double: boolean; heal: number; miss?: boolean };
  hurt?: { damage: number; miss?: boolean };
  kill?: { gold: number };
  stageCleared?: boolean;
  death?: boolean;
}

/**
 * Advance the simulation by one fixed tick. Only runs while phase === 'fighting'
 * (relic/event/dead phases pause the sim until the player acts). Deterministic
 * given (save, rngState). Mutates `save` in place.
 *
 * `afkFarm` (window unfocused / offline): the hero farms the CURRENT enemy on
 * repeat — kills pay gold but never advance the wave, and a killing blow resets
 * the fight instead of ending the run. You never come back to a dead hero.
 */
export function stepSim(save: GameSave, afkFarm = false): TickEvents {
  if (save.run.phase !== 'fighting') return {};
  const rng = new Rng(save.rngState);
  const events = stepFighting(save, rng, afkFarm);
  save.rngState = rng.state;
  return events;
}

/** Damage rolls 90%–110% of the computed value. */
function vary(rng: Rng, dmg: number): number {
  return Math.max(1, Math.round(dmg * (1 - DMG_VARIANCE + rng.next() * DMG_VARIANCE * 2)));
}

function stepFighting(save: GameSave, rng: Rng, afkFarm: boolean): TickEvents {
  const events: TickEvents = {};
  const run = save.run;
  const hero = run.hero;
  const enemy = run.enemy;
  const s = run.stats;
  const dt = TICK_DT;

  if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);

  // Ceasefire while the next enemy makes its entrance.
  if (run.spawnGrace > 0) {
    run.spawnGrace = Math.max(0, run.spawnGrace - dt);
    return events;
  }

  // Continuous poison + summon damage.
  const passive = s.dotDps + s.summonPct * s.attack * s.attackSpeed;
  if (passive > 0 && enemy.hp > 0) enemy.hp -= passive * dt;

  // Hero attacks (bounded loop — guards against pathological attackSpeed).
  hero.cooldown -= dt;
  let atk = 0;
  while (hero.cooldown <= 0 && enemy.hp > 0 && atk < MAX_ATTACKS_PER_TICK) {
    atk++;
    hero.cooldown += 1 / s.attackSpeed;
    if (rng.next() < MISS_CHANCE) {
      events.hit = { damage: 0, crit: false, double: false, heal: 0, miss: true };
      continue;
    }
    // Crit chance may exceed 100%: the whole part guarantees a crit, and the
    // overflow (e.g. 1.3 → 0.30) is the chance to upgrade it into a double crit.
    let crit: boolean;
    let dbl = false;
    if (s.critChance >= 1) {
      crit = true;
      dbl = rng.next() < s.critChance - 1;
    } else {
      crit = rng.next() < s.critChance;
    }
    const mult = dbl ? s.critMult * 2 : crit ? s.critMult : 1;
    const dmg = vary(rng, s.attack * mult);
    enemy.hp -= dmg;
    enemy.flash = 0.12;
    let heal = 0;
    if (s.lifesteal > 0) {
      const before = hero.hp;
      hero.hp = Math.min(s.maxHp, hero.hp + dmg * s.lifesteal);
      heal = hero.hp - before;
    }
    events.hit = { damage: dmg, crit, double: dbl, heal };
  }

  if (enemy.hp <= 0) {
    const gold = Math.max(1, Math.round(enemy.goldReward * s.goldMult));
    run.gold += gold;
    run.kills += 1;
    bumpDaily(save, 'kills');
    events.kill = { gold };
    if (afkFarm) {
      // AFK: farm the same creature over and over — no progression, no risk.
      run.enemy = makeEnemy(run.stage, enemy.kind);
      run.spawnGrace = SPAWN_GRACE;
    } else if (advanceWave(save, rng)) {
      events.stageCleared = true;
    }
    return events; // enemy dead — skip its retaliation this tick
  }

  // Enemy attacks (bounded loop).
  enemy.cooldown -= dt;
  let eatk = 0;
  while (enemy.cooldown <= 0 && hero.hp > 0 && eatk < MAX_ATTACKS_PER_TICK) {
    eatk++;
    enemy.cooldown += 1 / enemy.attackSpeed;
    if (rng.next() < MISS_CHANCE) {
      events.hurt = { damage: 0, miss: true };
      continue;
    }
    const raw = enemy.attack;
    const dmg = vary(rng, Math.max(1, raw - s.armor));
    hero.hp -= dmg;
    if (s.thorns > 0) enemy.hp -= raw * s.thorns;
    events.hurt = { damage: dmg };
    if (hero.hp <= 0) {
      if (afkFarm) {
        // AFK: never die — shake it off and retry the same fight.
        hero.hp = s.maxHp;
        run.enemy = makeEnemy(run.stage, enemy.kind);
        run.spawnGrace = SPAWN_GRACE;
        break;
      }
      hero.hp = 0;
      events.death = true;
      die(save, rng);
      break;
    }
  }

  return events;
}
