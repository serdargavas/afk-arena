import { TICK_DT, MAX_ATTACKS_PER_TICK } from './constants';
import { Rng } from './rng';
import { advanceWave, die } from './run';
import type { GameSave } from './types';

/** Render-relevant things that happened during a tick (drive particles/juice). */
export interface TickEvents {
  hit?: { damage: number; crit: boolean; double: boolean; heal: number };
  hurt?: { damage: number };
  kill?: { gold: number };
  stageCleared?: boolean;
  death?: boolean;
}

/**
 * Advance the simulation by one fixed tick. Only runs while phase === 'fighting'
 * (relic/event/dead phases pause the sim until the player acts). Deterministic
 * given (save, rngState). Mutates `save` in place.
 */
export function stepSim(save: GameSave): TickEvents {
  if (save.run.phase !== 'fighting') return {};
  const rng = new Rng(save.rngState);
  const events = stepFighting(save, rng);
  save.rngState = rng.state;
  return events;
}

function stepFighting(save: GameSave, rng: Rng): TickEvents {
  const events: TickEvents = {};
  const run = save.run;
  const hero = run.hero;
  const enemy = run.enemy;
  const s = run.stats;
  const dt = TICK_DT;

  if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);

  // Continuous poison + summon damage.
  const passive = s.dotDps + s.summonPct * s.attack * s.attackSpeed;
  if (passive > 0 && enemy.hp > 0) enemy.hp -= passive * dt;

  // Hero attacks (bounded loop — guards against pathological attackSpeed).
  hero.cooldown -= dt;
  let atk = 0;
  while (hero.cooldown <= 0 && enemy.hp > 0 && atk < MAX_ATTACKS_PER_TICK) {
    atk++;
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
    const dmg = Math.max(1, Math.round(s.attack * mult));
    enemy.hp -= dmg;
    enemy.flash = 0.12;
    let heal = 0;
    if (s.lifesteal > 0) {
      const before = hero.hp;
      hero.hp = Math.min(s.maxHp, hero.hp + dmg * s.lifesteal);
      heal = hero.hp - before;
    }
    events.hit = { damage: dmg, crit, double: dbl, heal };
    hero.cooldown += 1 / s.attackSpeed;
  }

  if (enemy.hp <= 0) {
    const gold = Math.max(1, Math.round(enemy.goldReward * s.goldMult));
    run.gold += gold;
    run.kills += 1;
    events.kill = { gold };
    if (advanceWave(save, rng)) events.stageCleared = true;
    return events; // enemy dead — skip its retaliation this tick
  }

  // Enemy attacks (bounded loop).
  enemy.cooldown -= dt;
  let eatk = 0;
  while (enemy.cooldown <= 0 && hero.hp > 0 && eatk < MAX_ATTACKS_PER_TICK) {
    eatk++;
    const raw = enemy.attack;
    const dmg = Math.max(1, Math.round(raw - s.armor));
    hero.hp -= dmg;
    if (s.thorns > 0) enemy.hp -= raw * s.thorns;
    events.hurt = { damage: dmg };
    enemy.cooldown += 1 / enemy.attackSpeed;
    if (hero.hp <= 0) {
      hero.hp = 0;
      events.death = true;
      die(save, rng);
      break;
    }
  }

  return events;
}
