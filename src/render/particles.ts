// Fixed-size object pool for floating text (damage numbers, gold pops).
// Ring-buffer reuse → zero per-particle allocation at runtime.

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

export interface SpawnOpts {
  x: number;
  y: number;
  text: string;
  color: string;
  size?: number;
  vx?: number;
  vy?: number;
  maxLife?: number;
}

const GRAVITY = 34; // px/s^2 — gentle upward-then-settle arc

export class ParticlePool {
  private readonly pool: Particle[];
  private idx = 0;

  constructor(size = 48) {
    this.pool = Array.from({ length: size }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      text: '',
      color: '#fff',
      size: 10,
    }));
  }

  spawn(o: SpawnOpts): void {
    const p = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.pool.length;
    p.active = true;
    p.x = o.x;
    p.y = o.y;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? -28;
    p.maxLife = o.maxLife ?? 0.8;
    p.life = p.maxLife;
    p.text = o.text;
    p.color = o.color;
    p.size = o.size ?? 11;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += GRAVITY * dt;
    }
  }

  forEachActive(fn: (p: Particle) => void): void {
    for (const p of this.pool) if (p.active) fn(p);
  }
}
