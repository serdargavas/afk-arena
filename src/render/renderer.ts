import type { GameSave, ClassId, EnemyKind } from '../game/types';
import type { ParticlePool } from './particles';
import { biomeForStage } from '../game/content/biomes';
import { BIOME_STAGES } from '../game/constants';

// Modern (non-pixel) renderer: gradients, soft glows, smooth shapes and an
// animated sword swing with a motion trail. Animation timing uses a wall clock
// so it stays smooth between simulation ticks.

const CLASS_COLOR: Record<ClassId, { lite: string; dark: string; glow: string }> = {
  warrior: { lite: '#8fe1ff', dark: '#2f6fb0', glow: '#63d3ff' },
  mage: { lite: '#d7a6ff', dark: '#6f2fb0', glow: '#c77aff' },
  ranger: { lite: '#a6f0b4', dark: '#2f9f55', glow: '#7ce08a' },
};

const KIND_SCALE: Record<EnemyKind, number> = { normal: 1, elite: 1.35, boss: 1.85 };
const SWING_MS = 260;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssW = 360;
  private cssH = 300;
  private layout = { heroX: 100, enemyX: 260, baseY: 240, unit: 30 };
  private swingStart = -9999;
  private hurtFlash = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly particles: ParticlePool,
  ) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  private clock(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.layout.heroX = Math.round(this.cssW * 0.27);
    this.layout.enemyX = Math.round(this.cssW * 0.72);
    this.layout.baseY = Math.round(this.cssH * 0.82);
    this.layout.unit = Math.max(20, Math.min(46, this.cssH * 0.135));
  }

  onHit(damage: number, crit: boolean): void {
    this.swingStart = this.clock();
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - this.layout.unit * 1.6,
      vx: crit ? 0 : 8,
      vy: -34,
      text: crit ? `${damage}!` : `${damage}`,
      color: crit ? '#ffd93d' : '#ffffff',
      size: crit ? 20 : 13,
      maxLife: crit ? 1.0 : 0.7,
    });
  }

  onHurt(damage: number): void {
    this.hurtFlash = 1;
    this.particles.spawn({
      x: this.layout.heroX,
      y: this.layout.baseY - this.layout.unit * 1.5,
      vx: -8,
      vy: -26,
      text: `-${damage}`,
      color: '#ff6b6b',
      size: 12,
      maxLife: 0.6,
    });
  }

  onKill(gold: number): void {
    this.particles.spawn({
      x: this.layout.enemyX,
      y: this.layout.baseY - this.layout.unit * 0.8,
      vx: -12,
      vy: -40,
      text: `+${gold}`,
      color: '#ffd93d',
      size: 14,
      maxLife: 1.1,
    });
  }

  render(save: GameSave): void {
    const ctx = this.ctx;
    const run = save.run;
    const w = this.cssW;
    const h = this.cssH;
    const t = this.clock() / 1000;
    const { heroX, enemyX, baseY, unit } = this.layout;
    const biome = biomeForStage(run.stage, BIOME_STAGES);

    this.drawBackground(biome, w, h, baseY, t);

    // enemy
    if (run.phase !== 'dead') {
      const scale = KIND_SCALE[run.enemy.kind] * (unit / 30);
      this.drawEnemy(enemyX, baseY, scale, biome.enemy, biome.enemyDk, run.enemy.flash > 0, run.enemy.kind, t);
      const frac = run.enemy.maxHp > 0 ? run.enemy.hp / run.enemy.maxHp : 0;
      const barW = run.enemy.kind === 'boss' ? 88 : run.enemy.kind === 'elite' ? 70 : 56;
      this.drawBar(enemyX, baseY - 46 * scale - 14, frac, '#ff4d5e', '#ff9d6e', barW);
      if (run.enemy.kind !== 'normal') this.drawTag(enemyX, baseY - 46 * scale - 26, run.enemy.kind);
    }

    // hero
    const alive = run.phase !== 'dead';
    this.drawHero(save.run.hero.classId, heroX, baseY, unit, run, alive, t);
    this.drawBar(heroX, baseY + 12, run.hero.hp / Math.max(1, run.stats.maxHp), '#4fd06a', '#a6f07a', 50);

    // particles (glowing text)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    this.particles.forEachActive((p) => {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.font = `700 ${p.size}px ui-sans-serif, -apple-system, "SF Pro", system-ui, sans-serif`;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.restore();

    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - 0.08);
  }

  // ---- background ----
  private drawBackground(
    biome: { sky: string; sky2: string; ground: string; groundTop: string },
    w: number,
    h: number,
    baseY: number,
    t: number,
  ): void {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, baseY);
    sky.addColorStop(0, biome.sky);
    sky.addColorStop(1, biome.sky2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, baseY);

    // soft moon / orb
    const mx = w * 0.78;
    const my = baseY * 0.32;
    const orb = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
    orb.addColorStop(0, 'rgba(255,255,255,0.28)');
    orb.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(mx, my, 46, 0, Math.PI * 2);
    ctx.fill();

    // distant hills (parallax silhouette)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 20) {
      const y = baseY - 26 - Math.sin(x * 0.02 + 1.3) * 12 - Math.sin(x * 0.008) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, baseY);
    ctx.closePath();
    ctx.fill();

    // ground
    const gr = ctx.createLinearGradient(0, baseY, 0, h);
    gr.addColorStop(0, biome.groundTop);
    gr.addColorStop(1, biome.ground);
    ctx.fillStyle = gr;
    ctx.fillRect(0, baseY, w, h - baseY);

    // horizon glow
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 0.5);
    ctx.lineTo(w, baseY + 0.5);
    ctx.stroke();
    ctx.restore();

    // vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    void t;
  }

  // ---- shadow ----
  private drawShadow(cx: number, y: number, rx: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, rx * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- hero ----
  private drawHero(
    cls: ClassId,
    cx: number,
    feetY: number,
    unit: number,
    run: GameSave['run'],
    alive: boolean,
    t: number,
  ): void {
    const ctx = this.ctx;
    const col = CLASS_COLOR[cls] ?? CLASS_COLOR.warrior;
    const bob = alive ? Math.sin(t * 3) * unit * 0.04 : 0;
    const cy = feetY - unit * 1.05 + bob;
    this.drawShadow(cx, feetY + 2, unit * 0.7);

    ctx.save();
    if (!alive) {
      ctx.globalAlpha = 0.5;
      ctx.translate(cx, feetY);
      ctx.rotate(-0.5);
      ctx.translate(-cx, -feetY);
    }

    const lite = alive ? col.lite : '#8a8a9a';
    const dark = alive ? col.dark : '#4a4a5a';

    // legs
    ctx.strokeStyle = dark;
    ctx.lineCap = 'round';
    ctx.lineWidth = unit * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - unit * 0.18, feetY - unit * 0.5);
    ctx.lineTo(cx - unit * 0.22, feetY);
    ctx.moveTo(cx + unit * 0.18, feetY - unit * 0.5);
    ctx.lineTo(cx + unit * 0.22, feetY);
    ctx.stroke();

    // body (capsule with gradient)
    const bodyGrad = ctx.createLinearGradient(cx - unit * 0.4, cy, cx + unit * 0.4, cy);
    bodyGrad.addColorStop(0, dark);
    bodyGrad.addColorStop(0.5, lite);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    this.roundedCapsule(cx, cy - unit * 0.1, unit * 0.62, unit * 0.95, unit * 0.24);

    // head
    const headY = cy - unit * 0.72;
    const hg = ctx.createRadialGradient(cx - unit * 0.1, headY - unit * 0.1, 2, cx, headY, unit * 0.34);
    hg.addColorStop(0, lite);
    hg.addColorStop(1, dark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, headY, unit * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // visor
    if (alive) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(cx + unit * 0.04, headY - unit * 0.06, unit * 0.16, unit * 0.08);
    }

    // sword arm
    if (alive) this.drawSword(cx, cy - unit * 0.15, unit, col.glow, run);

    ctx.restore();
  }

  private roundedCapsule(cx: number, cy: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  private drawSword(shoulderX: number, shoulderY: number, unit: number, glow: string, run: GameSave['run']): void {
    const ctx = this.ctx;
    const now = this.clock();
    const sp = Math.min(1, Math.max(0, (now - this.swingStart) / SWING_MS));
    const swinging = sp < 1;

    let angle: number;
    if (swinging) {
      angle = (-75 + easeOutCubic(sp) * 135) * (Math.PI / 180); // raised -> follow-through
    } else {
      const period = 1 / Math.max(0.1, run.stats.attackSpeed);
      const windup = 1 - Math.min(1, Math.max(0, run.hero.cooldown / period));
      angle = (-15 - windup * 55) * (Math.PI / 180);
    }

    const bladeLen = unit * 1.5;
    const drawBlade = (ang: number, alpha: number, blur: number) => {
      ctx.save();
      ctx.translate(shoulderX + unit * 0.35, shoulderY);
      ctx.rotate(ang);
      ctx.globalAlpha = alpha;
      // blade
      const bg = ctx.createLinearGradient(0, 0, bladeLen, 0);
      bg.addColorStop(0, '#dfe8f2');
      bg.addColorStop(1, '#ffffff');
      ctx.fillStyle = bg;
      ctx.shadowColor = glow;
      ctx.shadowBlur = blur;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(unit * 0.28, -unit * 0.06, bladeLen, unit * 0.12, unit * 0.06);
      else ctx.rect(unit * 0.28, -unit * 0.06, bladeLen, unit * 0.12);
      ctx.fill();
      // guard + hilt
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3a2c5e';
      ctx.fillRect(unit * 0.2, -unit * 0.18, unit * 0.1, unit * 0.36);
      ctx.fillStyle = glow;
      ctx.fillRect(0, -unit * 0.07, unit * 0.22, unit * 0.14);
      ctx.restore();
    };

    // motion trail during swing
    if (swinging) {
      for (let i = 1; i <= 3; i++) {
        const past = Math.max(0, sp - i * 0.12);
        const a = (-75 + easeOutCubic(past) * 135) * (Math.PI / 180);
        drawBlade(a, 0.12 * (4 - i), 4);
      }
      // slash crescent
      ctx.save();
      ctx.translate(shoulderX + unit * 0.35, shoulderY);
      ctx.globalAlpha = (1 - sp) * 0.7;
      ctx.strokeStyle = glow;
      ctx.lineWidth = unit * 0.16;
      ctx.lineCap = 'round';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, bladeLen * 0.9, -1.1, 0.7);
      ctx.stroke();
      ctx.restore();
    }

    drawBlade(angle, 1, swinging ? 10 : 5);
  }

  // ---- enemy ----
  private drawEnemy(
    cx: number,
    feetY: number,
    scale: number,
    body: string,
    dark: string,
    flashing: boolean,
    kind: EnemyKind,
    t: number,
  ): void {
    const ctx = this.ctx;
    const r = 22 * scale;
    const wob = 1 + Math.sin(t * 4) * 0.04;
    const cy = feetY - r * 1.05;
    this.drawShadow(cx, feetY + 2, r * 0.95);

    ctx.save();
    // aura for elite/boss
    if (kind !== 'normal') {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
      const aura = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.7);
      aura.addColorStop(0, kind === 'boss' ? '#ff5d73' : '#ffb347');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // body orb
    const bg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.2, cx, cy, r * 1.05);
    bg.addColorStop(0, flashing ? '#ffffff' : body);
    bg.addColorStop(1, flashing ? '#ffd0d5' : dark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * wob, r * (2 - wob), 0, 0, Math.PI * 2);
    ctx.fill();

    // boss horns
    if (kind === 'boss') {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx - r * 1.05, cy - r * 1.5);
      ctx.lineTo(cx - r * 0.35, cy - r * 0.95);
      ctx.closePath();
      ctx.moveTo(cx + r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx + r * 1.05, cy - r * 1.5);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.95);
      ctx.closePath();
      ctx.fill();
    }

    // eyes
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6;
    const ey = cy - r * 0.1;
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, ey, r * 0.14, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.32, ey, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0f14';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, ey, r * 0.07, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.34, ey, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawTag(cx: number, y: number, kind: EnemyKind): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '700 9px ui-sans-serif, -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = kind === 'boss' ? '#ff5d73' : '#ffb347';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillText(kind.toUpperCase(), cx, y);
    ctx.restore();
  }

  // ---- bars ----
  private drawBar(cx: number, y: number, frac: number, c1: string, c2: string, w: number): void {
    const ctx = this.ctx;
    const h = 7;
    const x = Math.round(cx - w / 2);
    const f = Math.max(0, Math.min(1, frac));
    ctx.save();
    // track
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    this.rr(x - 1, y - 1, w + 2, h + 2, 4);
    ctx.fill();
    // fill
    if (f > 0) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, c2);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 6;
      this.rr(x, y, Math.max(3, w * f), h, 3.5);
      ctx.fill();
    }
    ctx.restore();
  }

  private rr(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
}
