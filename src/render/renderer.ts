import type { GameState } from '../game/types';
import type { ParticlePool } from './particles';

// Retro palette. Procedural pixel-art (block rects) for Phase 1 — no asset
// dependency yet; a spritesheet loader arrives in Phase 4.
const C = {
  sky: '#160f2e',
  sky2: '#2a1c50',
  star: '#4a3a7a',
  groundTop: '#6b552f',
  ground: '#3f3120',
  hero: '#63d3ff',
  heroDk: '#2f7fc4',
  sword: '#e8eef5',
  enemy: '#ff5d73',
  enemyDk: '#b3243c',
  eye: '#160f2e',
  hpBack: '#241a33',
  hp: '#ff4d5e',
  hpEdge: '#0c0814',
  dmg: '#ffffff',
  crit: '#ffd93d',
  gold: '#ffd93d',
} as const;

const PX = 3; // pixel-block size in CSS px

const STAR_POINTS = [
  [0.08, 0.22], [0.2, 0.5], [0.33, 0.16], [0.48, 0.38], [0.6, 0.24],
  [0.72, 0.46], [0.85, 0.18], [0.93, 0.52], [0.15, 0.66], [0.78, 0.64],
];

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssW = 360;
  private cssH = 150;
  private layout = { heroX: 108, enemyX: 252, baseY: 108 };
  private stars: Array<{ x: number; y: number }> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly particles: ParticlePool,
  ) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  /** Sync backing store to CSS size × DPR and recompute layout anchors. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.layout.heroX = Math.round(this.cssW * 0.3);
    this.layout.enemyX = Math.round(this.cssW * 0.7);
    this.layout.baseY = Math.round(this.cssH * 0.74);
    this.stars = STAR_POINTS.map(([fx, fy]) => ({
      x: Math.round(fx * this.cssW),
      y: Math.round(fy * this.cssH * 0.7),
    }));
  }

  onHit(damage: number, crit: boolean): void {
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - 40,
      vx: crit ? 0 : 6,
      vy: -30,
      text: crit ? `${damage}!` : `${damage}`,
      color: crit ? C.crit : C.dmg,
      size: crit ? 16 : 11,
      maxLife: crit ? 0.95 : 0.7,
    });
  }

  onKill(gold: number): void {
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - 18,
      vx: -10,
      vy: -36,
      text: `+${gold}`,
      color: C.gold,
      size: 12,
      maxLife: 1.0,
    });
  }

  render(state: GameState, timeSec: number): void {
    const ctx = this.ctx;
    const w = this.cssW;
    const h = this.cssH;
    const { heroX, enemyX, baseY } = this.layout;

    // sky + stars
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.sky2;
    ctx.fillRect(0, 0, w, Math.round(baseY * 0.55));
    ctx.fillStyle = C.star;
    for (const s of this.stars) ctx.fillRect(s.x, s.y, 2, 2);

    // ground
    ctx.fillStyle = C.groundTop;
    ctx.fillRect(0, baseY, w, 2);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, baseY + 2, w, h - baseY - 2);

    // hero (idle bob + sword wind-up as the next attack nears)
    const bob = Math.round(Math.sin(timeSec * 3) * 1.2);
    const period = 1 / state.hero.attackSpeed;
    const windup = 1 - Math.min(1, Math.max(0, state.hero.cooldown / period));
    this.drawHero(heroX, baseY + bob, windup);

    // enemy (hit-flash on recent damage)
    this.drawEnemy(enemyX, baseY, state.enemy.flash > 0);

    // enemy HP bar
    const frac = state.enemy.maxHp > 0 ? state.enemy.hp / state.enemy.maxHp : 0;
    this.drawHpBar(enemyX, baseY - 44, frac);

    // particles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.particles.forEachActive((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.size}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  private block(x: number, y: number, wb: number, hb: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, wb * PX, hb * PX);
  }

  private drawHero(cx: number, feetY: number, windup: number): void {
    const x = Math.round(cx - 3 * PX);
    const y = Math.round(feetY - 12 * PX);
    this.block(x + 1 * PX, y + 9 * PX, 2, 3, C.heroDk); // left leg
    this.block(x + 4 * PX, y + 9 * PX, 2, 3, C.heroDk); // right leg
    this.block(x + 1 * PX, y + 4 * PX, 5, 5, C.hero); // torso
    this.block(x + 2 * PX, y + 0 * PX, 3, 4, C.hero); // head
    this.block(x + 4 * PX, y + 1 * PX, 1, 1, C.eye); // eye
    const swordY = y + Math.round(4 - windup * 3) * PX; // rises before the hit
    this.block(x + 6 * PX, swordY, 1, 6, C.sword); // blade
    this.block(x + 6 * PX, swordY + 6 * PX, 2, 1, C.heroDk); // guard
  }

  private drawEnemy(cx: number, feetY: number, flashing: boolean): void {
    const body = flashing ? C.dmg : C.enemy;
    const dark = flashing ? '#ffd0d5' : C.enemyDk;
    const x = Math.round(cx - 4 * PX);
    const y = Math.round(feetY - 8 * PX);
    this.block(x + 2 * PX, y + 1 * PX, 4, 3, body); // top
    this.block(x + 1 * PX, y + 3 * PX, 6, 5, body); // mid
    this.block(x + 0 * PX, y + 5 * PX, 8, 3, body); // base wide
    this.block(x + 1 * PX, y + 8 * PX, 6, 1, dark); // ground shadow
    this.block(x + 2 * PX, y + 3 * PX, 1, 2, C.eye); // eyes (face the hero)
    this.block(x + 4 * PX, y + 3 * PX, 1, 2, C.eye);
  }

  private drawHpBar(cx: number, y: number, frac: number): void {
    const w = 40;
    const hgt = 5;
    const x = Math.round(cx - w / 2);
    const ctx = this.ctx;
    ctx.fillStyle = C.hpEdge;
    ctx.fillRect(x - 1, y - 1, w + 2, hgt + 2);
    ctx.fillStyle = C.hpBack;
    ctx.fillRect(x, y, w, hgt);
    ctx.fillStyle = C.hp;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), hgt);
  }
}
