import {
  TICK_DT,
  TICK_DT_MS,
  MAX_STEPS_PER_FRAME,
  BULK_CATCHUP_THRESHOLD_MS,
  STORE_PUSH_INTERVAL_MS,
  AUTOSAVE_INTERVAL_MS,
  UNFOCUSED_FRAME_INTERVAL_MS,
} from './game/constants';
import { stepSim, type TickEvents } from './game/combat';
import { applyOffline } from './game/offline';
import { serialize } from './game/save';
import { heroDps } from './game/economy';
import type { GameState, UISnapshot } from './game/types';
import { Renderer } from './render/renderer';
import { ParticlePool } from './render/particles';
import { pushSnapshot } from './store/gameStore';
import { saveRaw } from './platform/storage';

function toSnapshot(s: GameState): UISnapshot {
  return {
    gold: Math.floor(s.gold),
    wave: s.wave,
    kills: s.kills,
    dps: Math.round(heroDps(s.hero)),
    enemyHp: Math.max(0, Math.ceil(s.enemy.hp)),
    enemyMaxHp: s.enemy.maxHp,
  };
}

/**
 * Owns the authoritative game state and the single rAF loop. Keeps the
 * simulation (fixed timestep) decoupled from rendering, React store pushes, and
 * autosave — each on its own cadence. See PLAN.md §3.
 */
export class GameLoop {
  readonly state: GameState;
  private readonly particles = new ParticlePool();
  private readonly renderer: Renderer;

  private acc = 0; // unspent real time (ms) waiting to become sim ticks
  private simTime = 0; // total simulated seconds (drives render animation)
  private focused = true;
  private running = false;
  private rafId = 0;

  private lastRenderAt = 0;
  private lastStorePush = 0;
  private lastAutosave = 0;

  constructor(state: GameState, canvas: HTMLCanvasElement) {
    this.state = state;
    this.renderer = new Renderer(canvas, this.particles);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const now = Date.now();
    this.state.lastSeen = now;
    this.lastRenderAt = now;
    this.lastStorePush = now;
    this.lastAutosave = now;
    this.renderer.resize();
    pushSnapshot(toSnapshot(this.state));
    window.addEventListener('resize', this.onResize);
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
  }

  setFocused(f: boolean): void {
    this.focused = f;
  }

  private onResize = (): void => this.renderer.resize();

  private frame = (): void => {
    if (!this.running) return;
    const now = Date.now();
    const realDelta = now - this.state.lastSeen;

    if (realDelta > BULK_CATCHUP_THRESHOLD_MS) {
      // Long stall / minimize / sleep — fold in analytically, don't tick-spin.
      applyOffline(this.state, realDelta / 1000);
      this.acc = 0;
    } else if (realDelta > 0) {
      this.acc += realDelta;
    }
    this.state.lastSeen = now;

    // Fixed-timestep simulation with a spiral-of-death guard.
    let steps = 0;
    while (this.acc >= TICK_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      const events = stepSim(this.state);
      if (this.focused) this.emit(events);
      this.acc -= TICK_DT_MS;
      this.simTime += TICK_DT;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0; // drop backlog

    // Render — full rate when focused, ~5fps when blurred.
    const renderInterval = this.focused ? 0 : UNFOCUSED_FRAME_INTERVAL_MS;
    if (now - this.lastRenderAt >= renderInterval) {
      const dt = Math.min(0.1, (now - this.lastRenderAt) / 1000) || 0.016;
      this.particles.update(dt);
      this.renderer.render(this.state, this.simTime);
      this.lastRenderAt = now;
    }

    // Throttled React store push (~3/sec).
    if (now - this.lastStorePush >= STORE_PUSH_INTERVAL_MS) {
      pushSnapshot(toSnapshot(this.state));
      this.lastStorePush = now;
    }

    // Autosave.
    if (now - this.lastAutosave >= AUTOSAVE_INTERVAL_MS) {
      this.lastAutosave = now;
      void saveRaw(serialize(this.state));
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  private emit(events: TickEvents): void {
    if (events.hit) this.renderer.onHit(events.hit.damage, events.hit.crit);
    if (events.kill) this.renderer.onKill(events.kill.gold);
  }
}
