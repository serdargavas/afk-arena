import type { GameSave, ClassId, EnemyKind } from '../game/types';
import type { ParticlePool } from './particles';
import { biomeForStage } from '../game/content/biomes';
import { BIOME_STAGES } from '../game/constants';

const PX = 3;

const CLASS_COLOR: Record<ClassId, { body: string; dark: string }> = {
  warrior: { body: '#63d3ff', dark: '#2f7fc4' },
  mage: { body: '#c77aff', dark: '#7a2fc4' },
  ranger: { body: '#7ce08a', dark: '#2f9f44' },
};

const UI = {
  star: '#ffffff33',
  hpBack: '#241a33',
  hpEdge: '#0c0814',
  heroHp: '#5fd06a',
  enemyHp: '#ff4d5e',
  dmg: '#ffffff',
  crit: '#ffd93d',
  hurt: '#ff5d5d',
  gold: '#ffd93d',
  eliteTag: '#ffb347',
  bossTag: '#ff5d73',
  sword: '#e8eef5',
  eye: '#0c0814',
};

const KIND_SCALE: Record<EnemyKind, number> = { normal: 1, elite: 1.4, boss: 1.9 };

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

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.layout.heroX = Math.round(this.cssW * 0.28);
    this.layout.enemyX = Math.round(this.cssW * 0.72);
    this.layout.baseY = Math.round(this.cssH * 0.78);
    this.stars = STAR_POINTS.map(([fx, fy]) => ({
      x: Math.round(fx * this.cssW),
      y: Math.round(fy * this.cssH * 0.7),
    }));
  }

  onHit(damage: number, crit: boolean): void {
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - 44,
      vx: crit ? 0 : 6,
      vy: -30,
      text: crit ? `${damage}!` : `${damage}`,
      color: crit ? UI.crit : UI.dmg,
      size: crit ? 16 : 11,
      maxLife: crit ? 0.95 : 0.7,
    });
  }

  onHurt(damage: number): void {
    this.particles.spawn({
      x: this.layout.heroX,
      y: this.layout.baseY - 40,
      vx: -6,
      vy: -22,
      text: `-${damage}`,
      color: UI.hurt,
      size: 10,
      maxLife: 0.6,
    });
  }

  onKill(gold: number): void {
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - 18,
      vx: -10,
      vy: -36,
      text: `+${gold}`,
      color: UI.gold,
      size: 12,
      maxLife: 1.0,
    });
  }

  render(save: GameSave, timeSec: number): void {
    const ctx = this.ctx;
    const run = save.run;
    const w = this.cssW;
    const h = this.cssH;
    const { heroX, enemyX, baseY } = this.layout;
    const biome = biomeForStage(run.stage, BIOME_STAGES);

    // sky + stars
    ctx.fillStyle = biome.sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = biome.sky2;
    ctx.fillRect(0, 0, w, Math.round(baseY * 0.55));
    ctx.fillStyle = UI.star;
    for (const s of this.stars) ctx.fillRect(s.x, s.y, 2, 2);

    // ground
    ctx.fillStyle = biome.groundTop;
    ctx.fillRect(0, baseY, w, 2);
    ctx.fillStyle = biome.ground;
    ctx.fillRect(0, baseY + 2, w, h - baseY - 2);

    // hero
    const alive = run.phase !== 'dead';
    const bob = Math.round(Math.sin(timeSec * 3) * 1.2);
    const period = 1 / Math.max(0.1, run.stats.attackSpeed);
    const windup = 1 - Math.min(1, Math.max(0, run.hero.cooldown / period));
    this.drawHero(heroX, baseY + bob, windup, run.hero.classId, alive);
    this.drawBar(heroX, baseY + 6, run.hero.hp / Math.max(1, run.stats.maxHp), UI.heroHp, 34);

    // enemy (hidden while dead / between screens has no live enemy meaning, but keep)
    if (run.phase !== 'dead') {
      const scale = KIND_SCALE[run.enemy.kind];
      this.drawEnemy(enemyX, baseY, scale, biome.enemy, biome.enemyDk, run.enemy.flash > 0);
      const frac = run.enemy.maxHp > 0 ? run.enemy.hp / run.enemy.maxHp : 0;
      const barW = run.enemy.kind === 'boss' ? 60 : run.enemy.kind === 'elite' ? 48 : 40;
      this.drawBar(enemyX, baseY - Math.round(30 * scale) - 10, frac, UI.enemyHp, barW);
      if (run.enemy.kind !== 'normal') {
        ctx.fillStyle = run.enemy.kind === 'boss' ? UI.bossTag : UI.eliteTag;
        ctx.font = 'bold 8px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(run.enemy.kind.toUpperCase(), enemyX, baseY - Math.round(30 * scale) - 16);
      }
    }

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

  private drawHero(cx: number, feetY: number, windup: number, cls: ClassId, alive: boolean): void {
    const col = CLASS_COLOR[cls] ?? CLASS_COLOR.warrior;
    const body = alive ? col.body : '#5a5a6a';
    const dark = alive ? col.dark : '#3a3a4a';
    const x = Math.round(cx - 3 * PX);
    const y = Math.round(feetY - 12 * PX);
    this.block(x + 1 * PX, y + 9 * PX, 2, 3, dark);
    this.block(x + 4 * PX, y + 9 * PX, 2, 3, dark);
    this.block(x + 1 * PX, y + 4 * PX, 5, 5, body);
    this.block(x + 2 * PX, y + 0 * PX, 3, 4, body);
    this.block(x + 4 * PX, y + 1 * PX, 1, 1, UI.eye);
    if (alive) {
      const swordY = y + Math.round(4 - windup * 3) * PX;
      this.block(x + 6 * PX, swordY, 1, 6, UI.sword);
      this.block(x + 6 * PX, swordY + 6 * PX, 2, 1, dark);
    }
  }

  private drawEnemy(cx: number, feetY: number, scale: number, body: string, dark: string, flashing: boolean): void {
    const bodyCol = flashing ? '#ffffff' : body;
    const p = PX * scale;
    const x = Math.round(cx - 4 * p);
    const y = Math.round(feetY - 8 * p);
    const b = (bx: number, by: number, bw: number, bh: number, c: string) => {
      this.ctx.fillStyle = c;
      this.ctx.fillRect(Math.round(x + bx * p), Math.round(y + by * p), Math.ceil(bw * p), Math.ceil(bh * p));
    };
    b(2, 1, 4, 3, bodyCol);
    b(1, 3, 6, 5, bodyCol);
    b(0, 5, 8, 3, bodyCol);
    b(1, 8, 6, 1, dark);
    b(2, 3, 1, 2, UI.eye);
    b(4, 3, 1, 2, UI.eye);
  }

  private drawBar(cx: number, y: number, frac: number, fill: string, w: number): void {
    const hgt = 5;
    const x = Math.round(cx - w / 2);
    const ctx = this.ctx;
    ctx.fillStyle = UI.hpEdge;
    ctx.fillRect(x - 1, y - 1, w + 2, hgt + 2);
    ctx.fillStyle = UI.hpBack;
    ctx.fillRect(x, y, w, hgt);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), hgt);
  }
}
