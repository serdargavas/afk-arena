import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Billboard, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { combatBus, type HitEvent } from './bus';
import { UNFOCUSED_FRAME_INTERVAL_MS } from '../game/constants';
import { formatNum } from '../ui/format';
import type { ClassId, EnemyKind } from '../game/types';

// The scene is a painted 2.5D diorama: the three pieces of key art (backdrop,
// knight, demon) live on textured planes, and all motion is puppet animation —
// lunges, leans, hops, squash — sold by layered FX (slash crescents, sparks,
// impact flashes, damage numbers, camera punch).

const CLASS: Record<ClassId, { glow: string; slash: string }> = {
  warrior: { glow: '#7cc4ff', slash: '#bfe2ff' },
  mage: { glow: '#c88cff', slash: '#e6ccff' },
  ranger: { glow: '#7ce09a', slash: '#c8ffd9' },
};

const BASE_X = -1.85; // knight's feet
const DEMON_X = 1.62; // demon's feet
const KNIGHT_H = 2.2;
const KNIGHT_W = KNIGHT_H * (600 / 415);
const DEMON_H = 2.15;
const DEMON_W = DEMON_H * (438 / 447);
// Where the blade meets the demon's hide — most FX spawn around here.
const IMPACT = { x: 0.75, y: 1.15, z: 0.35 };

const now = () => performance.now() / 1000;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

// ---------------- 5-hit combo ----------------
// Each strike is a distinct full-body move: the sword layer swings for real —
// `wind` is the anticipation angle it raises to before the hit, `hitRot` the
// angle it whips to at contact (positive = down through the enemy). `lean` tips
// the body into the blow, `lunge` steps in, `hop` arcs the body up and lands it
// exactly at the moment of contact, `slash` angles the crescent trail.
interface Strike {
  wind: number;
  hitRot: number;
  lean: number;
  lunge: number;
  hop: number;
  slash: number; // crescent rotation (rad)
  slashScale: number;
  slam?: boolean; // ground-shock finisher
}
const COMBO: Strike[] = [
  { wind: -0.55, hitRot: 1.45, lean: -0.26, lunge: 0.55, hop: 0.22, slash: -0.55, slashScale: 1.0 }, // 1 overhead chop
  { wind: 0.95, hitRot: -0.35, lean: -0.16, lunge: 0.72, hop: 0.08, slash: 2.35, slashScale: 0.9 }, // 2 rising backcut
  { wind: -0.85, hitRot: 1.9, lean: -0.34, lunge: 0.88, hop: 0.05, slash: -1.45, slashScale: 1.25 }, // 3 wide sweep
  { wind: 1.35, hitRot: -0.75, lean: 0.2, lunge: 0.6, hop: 0.42, slash: 1.7, slashScale: 1.05 }, // 4 launching uppercut
  { wind: -1.15, hitRot: 1.75, lean: -0.42, lunge: 1.1, hop: 0.72, slash: -0.95, slashScale: 1.6, slam: true }, // 5 sky-fall slam
];
const DUR = 0.5; // full swing (s)
const CONTACT = 0.2; // fraction of DUR where the blade lands ('hit' fires at contact)
const HOLD = 0.14; // hit-stop: fraction of DUR the extended strike pose is held before recovery

// Combo bookkeeping shared by every FX component. Handlers all receive the same
// event object, so the first one to ask advances the combo and the rest agree —
// no dependence on subscription order. `period` is an EMA of the attack interval:
// the combo only resets after a pause clearly longer than the hero's own cadence
// (a fixed gap would never let slow classes chain past hit 1), and the sword
// wind-up uses it to anticipate the next strike.
const rhythm = { combo: 0, last: -99, period: 1.1, stamp: null as HitEvent | null };
function comboFor(e: HitEvent): number {
  if (rhythm.stamp !== e) {
    const t = now();
    const delta = t - rhythm.last;
    if (delta < 3) rhythm.period = rhythm.period * 0.65 + delta * 0.35;
    rhythm.combo = delta > Math.min(2.6, rhythm.period * 1.6) ? 0 : (rhythm.combo + 1) % COMBO.length;
    rhythm.last = t;
    rhythm.stamp = e;
  }
  return rhythm.combo;
}

// ---------------- procedural FX textures ----------------
function radialTex(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d')!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Memoize a procedural texture and free its GPU memory when the owner unmounts
 *  (Demon/SlashFX unmount on every hero death, so their textures must be released). */
function useRadialTex(size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const tex = useMemo(() => radialTex(size, paint), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Soft round glow: white core → transparent. */
function useGlowTex() {
  return useRadialTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Anime slash crescent: bright moon-sliver with a hot core. */
function useCrescentTex() {
  return useRadialTex(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.48);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2);
    ctx.fill();
    // bite a circle out of the top-left to leave a crescent
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(s * 0.36, s * 0.36, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Elongated streak (claw marks / red hurt slashes). */
function useStreakTex() {
  return useRadialTex(128, (ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.scale(1, 0.18);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-s / 2, -s / 2, s, s);
  });
}

/** Cracked stone arena floor with glowing rune rings — the ground the fighters
 *  stand on, so they read as planted on a real surface instead of floating. */
function useGroundTex() {
  return useRadialTex(512, (ctx, s) => {
    const cx = s / 2;
    const cy = s * 0.5;
    // base stone: warm-lit centre fading to near-black at the edges
    const base = ctx.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.62);
    base.addColorStop(0, '#241f38');
    base.addColorStop(0.5, '#0f0b1e');
    base.addColorStop(1, '#04030a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // stone grain: flecks of light and dark, denser toward the lit centre
    for (let i = 0; i < 1600; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.7) * s * 0.6;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.9;
      const light = Math.random() > 0.5;
      ctx.fillStyle = light
        ? `rgba(180,175,205,${Math.random() * 0.05})`
        : `rgba(0,0,0,${Math.random() * 0.09})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.7 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // flagstone cracks radiating out of the arena centre
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2.2;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.35;
      let x = cx + Math.cos(a) * s * 0.06;
      let y = cy + Math.sin(a) * s * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const seg = 7 + Math.floor(Math.random() * 4);
      for (let j = 0; j < seg; j++) {
        x += Math.cos(a) * s * 0.055 + (Math.random() - 0.5) * 9;
        y += Math.sin(a) * s * 0.055 + (Math.random() - 0.5) * 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // glowing rune rings (bloom picks these up into a faint magic circle)
    for (const [rr, al, col] of [
      [0.28, 0.5, '#5f7cff'],
      [0.4, 0.34, '#9a5cff'],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = al;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * rr, s * rr * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Damage vignette: transparent center → solid edges (tinted via material color). */
function useVignetteTex() {
  return useRadialTex(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s * 0.52);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// ---------------- Backdrop (key art + nebula pulse + drifting embers) ----------------
function Backdrop() {
  const tex = useTexture('/art/bg.jpg');
  const group = useRef<THREE.Group>(null);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);

  useFrame(() => {
    const t = now();
    const g = group.current;
    if (!g) return;
    // slow "living painting" drift — barely perceptible, keeps the frame breathing
    g.position.x = Math.sin(t * 0.05) * 0.35;
    g.position.y = 2.4 + Math.sin(t * 0.08) * 0.12;
  });

  return (
    <group ref={group} position={[0, 2.4, -9]}>
      <mesh renderOrder={0}>
        <planeGeometry args={[22, 22 / (597 / 335)]} />
        <meshBasicMaterial map={tex} depthWrite={false} />
      </mesh>
      {/* bottom fade so the art melts into the arena floor instead of ending in a hard edge */}
      <mesh position={[0, -5.4, 0.05]} renderOrder={1}>
        <planeGeometry args={[22, 4.4]} />
        <meshBasicMaterial color="#060410" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

function NebulaPulse() {
  const glow = useGlowTex();
  const a = useRef<THREE.MeshBasicMaterial>(null);
  const b = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const t = now();
    if (a.current) a.current.opacity = 0.16 + Math.sin(t * 0.4) * 0.07;
    if (b.current) b.current.opacity = 0.13 + Math.sin(t * 0.31 + 2) * 0.06;
  });
  return (
    <>
      <mesh position={[3.4, 3.4, -8.5]} renderOrder={2}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial ref={a} map={glow} color="#ff5da2" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[-3.6, 4.2, -8.5]} renderOrder={2}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial ref={b} map={glow} color="#5a6cff" transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Ambient drifting motes: warm embers on the demon's side, cold star-dust on the knight's. */
const EMBER_N = 42;
function Embers() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glow = useGlowTex();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(
    () =>
      Array.from({ length: EMBER_N }, (_, i) => ({
        x: -4 + Math.random() * 8,
        y: Math.random() * 4.5,
        z: -2 - Math.random() * 4,
        speed: 0.12 + Math.random() * 0.25,
        wob: Math.random() * Math.PI * 2,
        size: 0.05 + Math.random() * 0.08,
        warm: i % 2 === 0,
      })),
    [],
  );

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const warm = new THREE.Color('#ff9a4a');
    const cold = new THREE.Color('#7ab8ff');
    parts.forEach((p, i) => m.setColorAt(i, p.warm ? warm : cold));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const t = now();
    for (let i = 0; i < EMBER_N; i++) {
      const p = parts[i];
      p.y += p.speed * dt;
      if (p.y > 5) {
        p.y = -0.2;
        p.x = (p.warm ? 0.5 : -4) + Math.random() * 4;
      }
      const flicker = 0.75 + Math.sin(t * 3 + p.wob) * 0.25;
      dummy.position.set(p.x + Math.sin(t * 0.6 + p.wob) * 0.3, p.y, p.z);
      dummy.scale.setScalar(p.size * flicker);
      dummy.quaternion.copy(state.camera.quaternion);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, EMBER_N]} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={glow} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** Arena floor: a detailed cracked-stone slab with a glowing rune circle, plus a
 *  soft light pool so the fighters read as planted on real ground. */
function ArenaFloor() {
  const glow = useGlowTex();
  const ground = useGroundTex();
  return (
    <>
      {/* cracked stone slab (the detailed ground) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -1]} renderOrder={2}>
        <planeGeometry args={[26, 17]} />
        <meshBasicMaterial map={ground} transparent opacity={0.97} depthWrite={false} />
      </mesh>
      {/* warm light pool spilling from the fight */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0, 0.6]} renderOrder={3}>
        <planeGeometry args={[9, 4]} />
        <meshBasicMaterial map={glow} color="#4a3f7a" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

function BlobShadow({ w, opacity = 0.5 }: { w: number; opacity?: number }) {
  const glow = useGlowTex();
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0.1]} renderOrder={4}>
      <planeGeometry args={[w, w * 0.32]} />
      <meshBasicMaterial map={glow} color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ---------------- Knight (key-art sprite, puppet-animated) ----------------
// The knight art is split into three registered layers (same 600×415 px space):
// body (blade inpainted out), the sword itself, and a guard+fists patch that
// renders in front of the sword to hide the pivot seam. The sword rotates for
// real around the grip: it winds up before the predicted hit, whips through the
// strike, and eases back — with additive ghost copies as motion blur.
const KNIGHT_PX = KNIGHT_W / 600; // world units per source pixel
const GRIP = { x: (390 / 600 - 0.5) * KNIGHT_W, y: (0.5 - 195 / 415) * KNIGHT_H }; // fists
// sword.png: crop of source rect (1,0)–(363,272) → its center relative to the grip
const SWORD_W = 362 * KNIGHT_PX;
const SWORD_H = 272 * KNIGHT_PX;
const SWORD_OFF = { x: (182 - 390) * KNIGHT_PX, y: (195 - 136) * KNIGHT_PX };
// hands.png: crop of source rect (332,85)–(457,262)
const HANDS_W = 125 * KNIGHT_PX;
const HANDS_H = 177 * KNIGHT_PX;
const HANDS_POS = { x: (394.5 / 600 - 0.5) * KNIGHT_W, y: (0.5 - 173.5 / 415) * KNIGHT_H };
const DEATH_TINT = new THREE.Color('#4a4a58');
const BRUISE_TINT = new THREE.Color('#ff4433');
const GHOSTS = [
  { lag: 2, peak: 0.4 },
  { lag: 4, peak: 0.2 },
];

function Knight({ alive }: { alive: boolean }) {
  const [bodyTex, swordTex, handsTex] = useTexture([
    '/art/knight-body.png',
    '/art/sword.png',
    '/art/hands.png',
  ]);
  const group = useRef<THREE.Group>(null); // feet anchor: lunge + hop + death fall
  const body = useRef<THREE.Group>(null); // lean + squash
  const swordPivot = useRef<THREE.Group>(null); // the actual swing
  const ghostMats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const ghostGroups = useRef<Array<THREE.Group | null>>([]);
  const mats = useRef<Array<THREE.MeshBasicMaterial | null>>([]); // body, sword, hands tints
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const shadow = useRef<THREE.Group>(null);
  const swing = useRef({ start: -99, combo: 0 });
  const rot = useRef({ cur: 0, hist: [0, 0, 0, 0, 0, 0] });
  const hurt = useRef(0); // 1 → 0 flinch when struck
  const land = useRef(0); // 1 → 0 squash impulse at contact
  const tint = useMemo(() => new THREE.Color('#ffffff'), []);

  useMemo(() => {
    for (const tex of [bodyTex, swordTex, handsTex]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    }
  }, [bodyTex, swordTex, handsTex]);

  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      swing.current.combo = comboFor(e);
      swing.current.start = now();
    });
    const offHurt = combatBus.on('hurt', () => {
      hurt.current = 1;
    });
    return () => {
      offHit();
      offHurt();
    };
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    const bd = body.current;
    const sp = swordPivot.current;
    if (!g || !bd || !sp) return;
    const t = now();
    const s = swing.current;
    const step = COMBO[s.combo] ?? COMBO[0];

    // strike envelope: whip to full extension by CONTACT, then ease home
    const raw = s.start < 0 ? 1 : clamp01((t - s.start) / DUR);
    const strike = raw < CONTACT ? easeOutQuart(raw / CONTACT) : 1 - easeInOut((raw - CONTACT) / (1 - CONTACT));
    // hop arcs up and lands exactly at contact (sells the slam)
    const hopArc = Math.sin(Math.PI * clamp01(raw / CONTACT)) * step.hop;
    if (s.start > 0 && t - s.start <= DUR + 0.05 && raw >= CONTACT && raw - dt / DUR < CONTACT) land.current = 1;
    land.current = Math.max(0, land.current - dt / 0.16);
    hurt.current = Math.max(0, hurt.current - dt / 0.3);
    const sq = easeOutQuart(land.current);
    const flinch = easeOutQuart(hurt.current);

    let swordTarget: number;
    if (alive) {
      const breathe = Math.sin(t * 2.1);
      const next = COMBO[(s.combo + 1) % COMBO.length];
      // One shared swing curve drives BOTH the torso twist and the wrist snap, so
      // the whole body powers the blow: it winds back off the enemy during the
      // anticipation, whips to the contact angle, overshoots a touch, then eases
      // home — and while idle it cocks back toward the next strike's wind-up.
      const swingAngle = (windA: number, hitA: number, nextWindA: number) => {
        // wind-up → whip to contact → HOLD the extended pose (hit-stop) → ease home
        if (raw < CONTACT) return THREE.MathUtils.lerp(windA, hitA, easeOutQuart(raw / CONTACT));
        if (raw < 1) {
          const back = easeInOut(clamp01((raw - CONTACT - HOLD) / (1 - CONTACT - HOLD)));
          return THREE.MathUtils.lerp(hitA * 1.06, 0, back);
        }
        const windT = Math.min(0.5, rhythm.period * 0.5);
        const w = s.start < 0 ? 0 : clamp01((t - (s.start + rhythm.period - windT)) / windT);
        return nextWindA * easeInOut(w);
      };

      // torso twist (feet planted, whole body + arms swing): amplified drive-through
      // with a real wind-back the other way. Because the fists sit ~1 unit above the
      // foot pivot, this alone sweeps the grip a long way — the arm visibly travels.
      const bodyHit = step.lean * 2.0;
      const bodyWind = -step.lean * 0.7;
      const bodySwing = swingAngle(bodyWind, bodyHit, -next.lean * 0.7);

      g.position.x = BASE_X + step.lunge * strike * 0.9 - flinch * 0.38;
      g.position.y = hopArc + Math.max(0, breathe) * 0.02;
      g.rotation.z = 0;
      bd.rotation.z = bodySwing + Math.sin(t * 1.1) * 0.02 + flinch * 0.22;
      // contact squash + idle breathing
      bd.scale.y = 1 - sq * 0.07 + breathe * 0.008;
      bd.scale.x = 1 + sq * 0.07;
      // hurt: flash the art red, then recover
      tint.setRGB(1, 1 - flinch * 0.55, 1 - flinch * 0.55);
      for (const m of mats.current) if (m) m.color.copy(tint);
      if (flashMat.current) flashMat.current.opacity = sq * 0.22;
      if (shadow.current) shadow.current.scale.setScalar(Math.max(0.4, 1 - hopArc * 0.5));

      // the wrist snap on top of the body twist (they compound into one big arc)
      swordTarget = swingAngle(step.wind, step.hitRot, next.wind) + (raw >= 1 ? Math.sin(t * 1.6) * 0.045 : 0);
    } else {
      // death: keel over backwards, blade slumps to the ground, color drains
      g.position.x += (BASE_X - g.position.x) * Math.min(1, dt * 5);
      g.position.y += (0 - g.position.y) * Math.min(1, dt * 5);
      bd.rotation.z += (0.9 - bd.rotation.z) * Math.min(1, dt * 3.5);
      bd.scale.x += (1 - bd.scale.x) * Math.min(1, dt * 4);
      bd.scale.y += (0.94 - bd.scale.y) * Math.min(1, dt * 4);
      tint.lerp(DEATH_TINT, Math.min(1, dt * 2.5));
      for (const m of mats.current) if (m) m.color.copy(tint);
      if (flashMat.current) flashMat.current.opacity = 0;
      swordTarget = 1.9;
    }

    // track the target fast enough to read as a whip, slow enough to stay smooth
    const r = rot.current;
    r.cur += (swordTarget - r.cur) * Math.min(1, dt * (alive ? 30 : 4));
    sp.rotation.z = r.cur;
    r.hist.unshift(r.cur);
    r.hist.length = 6;
    // motion-blur ghosts: trail the blade at lagged angles, fade with angular speed
    const speed = Math.abs(r.hist[0] - r.hist[2]);
    GHOSTS.forEach((gh, i) => {
      const grp = ghostGroups.current[i];
      const m = ghostMats.current[i];
      if (!grp || !m) return;
      grp.rotation.z = r.hist[gh.lag];
      m.opacity = alive ? Math.min(gh.peak, speed * 2.2) : 0;
    });
  });

  const sprite = (
    tex: THREE.Texture,
    w: number,
    h: number,
    matIdx: number | null,
    order: number,
    extra?: { ghost?: number },
  ) => (
    <mesh position={[0, 0, 0]} renderOrder={order}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        ref={(el) => {
          if (matIdx !== null) mats.current[matIdx] = el;
          if (extra?.ghost !== undefined) ghostMats.current[extra.ghost] = el;
        }}
        map={tex}
        transparent
        alphaTest={extra?.ghost !== undefined ? 0 : 0.02}
        opacity={extra?.ghost !== undefined ? 0 : 1}
        blending={extra?.ghost !== undefined ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={extra?.ghost === undefined}
      />
    </mesh>
  );

  // The art faces left, so the whole layer stack is mirrored to charge rightward;
  // the body sits at ~79% of the image width, hence the +x offset anchoring the feet.
  return (
    <group ref={group} position={[BASE_X, 0, 0]}>
      <group ref={shadow}>
        <BlobShadow w={2.1} />
      </group>
      <group ref={body}>
        <group scale={[-1, 1, 1]} position={[KNIGHT_W * 0.29, KNIGHT_H / 2, 0]}>
          {/* body (blade removed + inpainted) */}
          <group>{sprite(bodyTex, KNIGHT_W, KNIGHT_H, 0, 6)}</group>
          {/* motion-blur ghost blades (behind the real one) */}
          {GHOSTS.map((_, i) => (
            <group
              key={i}
              ref={(el) => void (ghostGroups.current[i] = el)}
              position={[GRIP.x, GRIP.y, 0.015]}
            >
              <group position={[SWORD_OFF.x, SWORD_OFF.y, 0]}>
                {sprite(swordTex, SWORD_W, SWORD_H, null, 7, { ghost: i })}
              </group>
            </group>
          ))}
          {/* the sword — pivots at the fists */}
          <group ref={swordPivot} position={[GRIP.x, GRIP.y, 0.02]}>
            <group position={[SWORD_OFF.x, SWORD_OFF.y, 0]}>{sprite(swordTex, SWORD_W, SWORD_H, 1, 8)}</group>
          </group>
          {/* guard + fists patch: static grip in front of the blade, hides the seam */}
          <group position={[HANDS_POS.x, HANDS_POS.y, 0.04]}>{sprite(handsTex, HANDS_W, HANDS_H, 2, 9)}</group>
          {/* additive copy of the body = white-hot flash on impact */}
          <mesh position={[0, 0, 0.05]} renderOrder={10}>
            <planeGeometry args={[KNIGHT_W, KNIGHT_H]} />
            <meshBasicMaterial
              ref={flashMat}
              map={bodyTex}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------------- Demon (key-art sprite) ----------------
const KIND: Record<EnemyKind, { scale: number; tint: string; flame: number }> = {
  normal: { scale: 1.0, tint: '#ffffff', flame: 1 },
  elite: { scale: 1.15, tint: '#ffd9a8', flame: 1.4 },
  boss: { scale: 1.3, tint: '#ff9d8f', flame: 2 },
};

function Demon({ kind }: { kind: EnemyKind }) {
  const tex = useTexture('/art/demon.png');
  const glow = useGlowTex();
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const clubGlow = useRef<THREE.MeshBasicMaterial>(null);
  const flailGlow = useRef<THREE.MeshBasicMaterial>(null);
  const shadow = useRef<THREE.Group>(null);
  const flash = useRef(0);
  const kb = useRef(0); // knockback (→0)
  const squash = useRef(0); // hit squash (1→0)
  const pop = useRef(0); // spawn pop-in after a kill (1→0)
  const conf = KIND[kind] ?? KIND.normal;
  const tint = useMemo(() => new THREE.Color(conf.tint), [conf.tint]);

  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
  }, [tex]);

  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      flash.current = 1;
      kb.current = e.double ? 0.95 : e.crit ? 0.7 : 0.45;
      squash.current = 1;
    });
    const offKill = combatBus.on('kill', () => {
      pop.current = 1; // the next fiend claws its way in
    });
    return () => {
      offHit();
      offKill();
    };
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    const bd = body.current;
    if (!g || !bd) return;
    const t = now();
    kb.current *= Math.pow(0.002, dt);
    squash.current = Math.max(0, squash.current - dt / 0.18);
    pop.current = Math.max(0, pop.current - dt / 0.4);
    flash.current = Math.max(0, flash.current - dt / 0.12);

    const sq = easeOutQuart(squash.current);
    const spawn = 0.55 + 0.45 * easeOutBack(1 - pop.current);

    // The fiend stands its ground — no idle breathing or sway. It only reacts to
    // blows it takes: knockback + squash below, plus the hit flash further down.
    g.position.x = DEMON_X + kb.current;
    g.rotation.z = kb.current * 0.3;
    bd.scale.set(conf.scale * (1 + sq * 0.16) * spawn, conf.scale * (1 - sq * 0.2) * spawn, 1);
    bd.rotation.z = 0;

    // hit flash: white-hot overlay + a red bruise on the base tint
    const f = easeOutQuart(flash.current);
    if (flashMat.current) flashMat.current.opacity = f * 0.85;
    if (mat.current) mat.current.color.copy(tint).lerp(BRUISE_TINT, f * 0.35);
    // living fire: the club-head and flail-ring glows flicker independently
    if (clubGlow.current) clubGlow.current.opacity = (0.5 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 11.7) * 0.1) * 0.55 * conf.flame;
    if (flailGlow.current) flailGlow.current.opacity = (0.5 + Math.sin(t * 6.1 + 2) * 0.2 + Math.sin(t * 13.3) * 0.08) * 0.5 * conf.flame;
    if (shadow.current) shadow.current.scale.setScalar(conf.scale * spawn);
  });

  return (
    <group ref={group} position={[DEMON_X, 0, 0]}>
      <group ref={shadow}>
        <BlobShadow w={2.3} opacity={0.55} />
      </group>
      <group ref={body}>
        {/* smoldering aura behind the whole silhouette */}
        <mesh position={[0, DEMON_H * 0.52, -0.08]} renderOrder={5}>
          <planeGeometry args={[DEMON_W * 1.5, DEMON_H * 1.4]} />
          <meshBasicMaterial map={glow} color="#7a1608" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, DEMON_H / 2, 0]} renderOrder={6}>
          <planeGeometry args={[DEMON_W, DEMON_H]} />
          <meshBasicMaterial ref={mat} map={tex} transparent alphaTest={0.02} depthWrite={false} />
        </mesh>
        <mesh position={[0, DEMON_H / 2, 0.01]} renderOrder={7}>
          <planeGeometry args={[DEMON_W, DEMON_H]} />
          <meshBasicMaterial ref={flashMat} map={tex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* fire glows pinned to the club head and the flaming flail in the art */}
        <mesh position={[-DEMON_W * 0.38, DEMON_H * 0.85, 0.05]} renderOrder={8}>
          <planeGeometry args={[DEMON_W * 0.48, DEMON_W * 0.48]} />
          <meshBasicMaterial ref={clubGlow} map={glow} color="#ff7722" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[DEMON_W * 0.02, DEMON_H * 0.55, 0.05]} renderOrder={8}>
          <planeGeometry args={[DEMON_W * 0.4, DEMON_W * 0.4]} />
          <meshBasicMaterial ref={flailGlow} map={glow} color="#ff9933" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------- Slash crescents (pooled — fast combos overlap) ----------------
const SLASH_N = 3;
function SlashFX({ classId }: { classId: ClassId }) {
  const col = CLASS[classId] ?? CLASS.warrior;
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const mats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const tex = useCrescentTex();
  const pool = useRef(Array.from({ length: SLASH_N }, () => ({ life: 0, rot: 0, big: 1, flip: 1 })));
  const cursor = useRef(0);

  useEffect(() => {
    return combatBus.on('hit', (e) => {
      const step = COMBO[comboFor(e)];
      const p = pool.current[cursor.current];
      cursor.current = (cursor.current + 1) % SLASH_N;
      p.life = 1;
      p.rot = step.slash + (Math.random() - 0.5) * 0.25;
      p.big = step.slashScale * (e.double ? 1.9 : e.crit ? 1.5 : 1);
      p.flip = step.slash > 0 ? -1 : 1;
    });
  }, []);

  useFrame((_, dt) => {
    for (let i = 0; i < SLASH_N; i++) {
      const p = pool.current[i];
      const m = meshes.current[i];
      const ma = mats.current[i];
      if (!m || !ma) continue;
      if (p.life > 0) p.life = Math.max(0, p.life - dt / 0.18);
      m.visible = p.life > 0;
      if (!m.visible) continue;
      const grow = easeOutQuart(1 - p.life);
      m.scale.set(p.big * (0.7 + grow * 0.55) * p.flip, p.big * (0.7 + grow * 0.55), 1);
      m.rotation.z = p.rot + grow * 0.45 * p.flip;
      ma.opacity = p.life * p.life;
    }
  });

  return (
    <>
      {Array.from({ length: SLASH_N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => void (meshes.current[i] = el)}
          position={[IMPACT.x - 0.15, IMPACT.y, IMPACT.z]}
          visible={false}
          renderOrder={9}
        >
          <planeGeometry args={[1.35, 1.35]} />
          <meshBasicMaterial
            ref={(el) => void (mats.current[i] = el)}
            map={tex}
            color={col.slash}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ---------------- Impact flash (hot core at the point of contact) ----------------
function ImpactFlash() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useGlowTex();
  const life = useRef(0);
  const big = useRef(1);

  useEffect(() => {
    return combatBus.on('hit', (e) => {
      life.current = 1;
      big.current = e.double ? 2.4 : e.crit ? 1.8 : 1;
    });
  }, []);

  useFrame((_, dt) => {
    if (life.current > 0) life.current = Math.max(0, life.current - dt / 0.09);
    const m = mesh.current;
    const ma = mat.current;
    if (!m || !ma) return;
    m.visible = life.current > 0;
    if (!m.visible) return;
    m.scale.setScalar(big.current * (0.5 + (1 - life.current) * 1.3));
    ma.opacity = life.current;
  });

  return (
    <mesh ref={mesh} position={[IMPACT.x, IMPACT.y, IMPACT.z + 0.05]} visible={false} renderOrder={10}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={glow} color="#fff6d8" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------------- Sparks (instanced burst; steel-gold on hit, red on hurt) ----------------
const SPARK_N = 80;
function Sparks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glow = useGlowTex();
  const parts = useRef(
    Array.from({ length: SPARK_N }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 })),
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cursor = useRef(0);
  const warm = useMemo(() => new THREE.Color('#ffdd77'), []);
  const red = useMemo(() => new THREE.Color('#ff3b3b'), []);

  const burst = (n: number, x: number, y: number, spd: number, color: THREE.Color, dir: number) => {
    const m = mesh.current;
    for (let i = 0; i < n; i++) {
      const idx = cursor.current;
      cursor.current = (cursor.current + 1) % SPARK_N;
      const p = parts.current[idx];
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI;
      const sp = spd * (0.5 + Math.random());
      p.x = x;
      p.y = y;
      p.z = 0.35;
      p.vx = Math.cos(a) * Math.sin(el) * sp + dir * spd * 0.4;
      p.vy = Math.abs(Math.cos(el)) * sp + 1.2;
      p.vz = Math.sin(a) * Math.sin(el) * sp * 0.5;
      p.life = p.max = 0.35 + Math.random() * 0.3;
      if (m) {
        m.setColorAt(idx, color);
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  };

  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      const step = COMBO[comboFor(e)];
      burst(e.double ? 34 : e.crit ? 22 : 12, IMPACT.x, IMPACT.y, e.double ? 5 : e.crit ? 4 : 2.6, warm, 1);
      if (step.slam) burst(14, IMPACT.x - 0.4, 0.15, 2.2, warm, 0); // dust kicked off the ground
    });
    const offHurt = combatBus.on('hurt', () => {
      burst(10, BASE_X + 0.3, 1.2, 2.4, red, -1); // hero blood-sparks fly backward
    });
    const offKill = combatBus.on('kill', () => {
      burst(30, DEMON_X, 1.2, 4.5, warm, 0); // soul burst
    });
    return () => {
      offHit();
      offHurt();
      offKill();
    };
  }, []);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const arr = parts.current;
    for (let i = 0; i < SPARK_N; i++) {
      const p = arr[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 8 * dt;
        dummy.position.set(p.x, Math.max(0.03, p.y), p.z);
        dummy.scale.setScalar(Math.max(0, p.life / p.max) * 0.16);
        dummy.quaternion.copy(state.camera.quaternion);
      } else {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPARK_N]} renderOrder={10}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------- Red claw streaks across the knight when he takes a bite ----------------
function HurtSlashes() {
  const streak = useStreakTex();
  const mats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const grp = useRef<THREE.Group>(null);
  const life = useRef(0);

  useEffect(() => {
    return combatBus.on('hurt', () => {
      life.current = 1;
    });
  }, []);

  useFrame((_, dt) => {
    if (life.current > 0) life.current = Math.max(0, life.current - dt / 0.22);
    const g = grp.current;
    if (!g) return;
    g.visible = life.current > 0;
    if (!g.visible) return;
    const grow = easeOutQuart(1 - life.current);
    g.scale.setScalar(0.7 + grow * 0.5);
    mats.current.forEach((m, i) => {
      if (m) m.opacity = life.current * (1 - i * 0.2);
    });
  });

  return (
    <group ref={grp} position={[BASE_X + 0.3, 1.25, 0.4]} rotation-z={-0.5} visible={false}>
      {[-0.16, 0, 0.16].map((y, i) => (
        <mesh key={i} position={[i * 0.08, y, i * 0.01]} renderOrder={11}>
          <planeGeometry args={[1.5, 0.5]} />
          <meshBasicMaterial
            ref={(el) => void (mats.current[i] = el)}
            map={streak}
            color="#ff2222"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------- Shockwaves (kill ring at the demon, slam ring at the impact) ----------------
function Shockwaves() {
  const kill = useRef<THREE.Mesh>(null);
  const killMat = useRef<THREE.MeshBasicMaterial>(null);
  const slam = useRef<THREE.Mesh>(null);
  const slamMat = useRef<THREE.MeshBasicMaterial>(null);
  const killLife = useRef(0);
  const slamLife = useRef(0);

  useEffect(() => {
    const offKill = combatBus.on('kill', () => {
      killLife.current = 1;
    });
    const offHit = combatBus.on('hit', (e) => {
      if (COMBO[comboFor(e)].slam) slamLife.current = 1;
    });
    return () => {
      offKill();
      offHit();
    };
  }, []);

  useFrame((_, dt) => {
    const tick = (mesh: THREE.Mesh | null, mat: THREE.MeshBasicMaterial | null, life: { current: number }, dur: number, size: number) => {
      if (life.current > 0) life.current = Math.max(0, life.current - dt / dur);
      if (!mesh || !mat) return;
      mesh.visible = life.current > 0;
      if (!mesh.visible) return;
      const grow = easeOutQuart(1 - life.current);
      mesh.scale.setScalar(0.3 + grow * size);
      mat.opacity = life.current * 0.85;
    };
    tick(kill.current, killMat.current, killLife, 0.45, 2.8);
    tick(slam.current, slamMat.current, slamLife, 0.32, 2.0);
  });

  return (
    <>
      <mesh ref={kill} rotation-x={-Math.PI / 2} position={[DEMON_X, 0.04, 0]} visible={false} renderOrder={9}>
        <ringGeometry args={[0.5, 0.72, 40]} />
        <meshBasicMaterial ref={killMat} color="#ffb055" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={slam} rotation-x={-Math.PI / 2} position={[IMPACT.x - 0.3, 0.04, 0]} visible={false} renderOrder={9}>
        <ringGeometry args={[0.5, 0.68, 40]} />
        <meshBasicMaterial ref={slamMat} color="#ffe9b0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---------------- Damage numbers (canvas-text sprites — offline-safe, no font fetch) ----------------
const DMG_N = 6;
interface DmgSlot {
  life: number;
  x: number;
  y: number;
  vy: number;
  scale: number;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
}
function DamageNumbers() {
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const mats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const cursor = useRef(0);
  const slots = useMemo<DmgSlot[]>(
    () =>
      Array.from({ length: DMG_N }, () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 128;
        const tex = new THREE.CanvasTexture(canvas);
        return { life: 0, x: 0, y: 0, vy: 0, scale: 1, canvas, tex };
      }),
    [],
  );

  const spawn = (label: string, text: string, x: number, y: number, fill: string, scale: number) => {
    const s = slots[cursor.current];
    const i = cursor.current;
    cursor.current = (cursor.current + 1) % DMG_N;
    const ctx = s.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 128);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8,4,16,0.95)';
    if (label) {
      ctx.font = '800 34px Rubik, Avenir, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeText(label, 160, 30);
      ctx.fillStyle = fill;
      ctx.fillText(label, 160, 30);
    }
    ctx.font = '800 66px Rubik, Avenir, sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeText(text, 160, label ? 90 : 64);
    ctx.fillStyle = fill;
    ctx.fillText(text, 160, label ? 90 : 64);
    s.tex.needsUpdate = true;
    s.life = 1;
    s.x = x + (Math.random() - 0.5) * 0.35;
    s.y = y;
    s.vy = 1.6;
    s.scale = scale;
    const ma = mats.current[i];
    if (ma) ma.map = s.tex;
  };

  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      // crit numbers are red now; a double crit (crit chance over 100%) is bigger + labelled
      // spawn toward the arena centre — the wide CRITICAL/DOUBLE labels must stay
      // inside the frame (spawning at the demon's x clipped them off the right edge)
      if (e.double) spawn('DOUBLE CRIT', formatNum(e.damage), 0.55, 2.15, '#ff2a2a', 1.6);
      else if (e.crit) spawn('CRITICAL', formatNum(e.damage), 0.7, 2.1, '#ff3b3b', 1.35);
      else spawn('', formatNum(e.damage), 0.9, 2.1, '#ffffff', 1);
      // lifesteal: green heal number floats off the knight (fractional heals would
      // render as a distracting "+0" — formatNum floors below 1 — so gate at 1 HP)
      if (e.heal && e.heal >= 1) spawn('', `+${formatNum(e.heal)}`, BASE_X + 0.7, 1.7, '#57ff93', 0.9);
    });
    const offHurt = combatBus.on('hurt', (e) => {
      spawn('', `-${formatNum(e.damage)}`, BASE_X + 0.65, 2.0, '#ff7a7a', 0.95);
    });
    return () => {
      offHit();
      offHurt();
    };
  }, []);

  useFrame((_, dt) => {
    for (let i = 0; i < DMG_N; i++) {
      const s = slots[i];
      const m = meshes.current[i];
      const ma = mats.current[i];
      if (!m || !ma) continue;
      if (s.life > 0) {
        s.life = Math.max(0, s.life - dt / 0.85);
        s.y += s.vy * dt;
        s.vy *= Math.pow(0.15, dt);
      }
      m.visible = s.life > 0;
      if (!m.visible) continue;
      // pop in with overshoot, drift up, fade out at the tail
      const age = 1 - s.life;
      const pop = age < 0.18 ? easeOutBack(age / 0.18) : 1;
      m.position.set(s.x, s.y, 1.2);
      m.scale.setScalar(s.scale * pop);
      ma.opacity = s.life < 0.35 ? s.life / 0.35 : 1;
    }
  });

  return (
    <>
      {Array.from({ length: DMG_N }, (_, i) => (
        <mesh key={i} ref={(el) => void (meshes.current[i] = el)} visible={false} renderOrder={12}>
          <planeGeometry args={[1.5, 0.6]} />
          <meshBasicMaterial
            ref={(el) => void (mats.current[i] = el)}
            map={slots[i].tex}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ---------------- Damage vignette (red edges pulse when the hero bleeds) ----------------
function HurtVignette() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useVignetteTex();
  const pulse = useRef(0);

  useEffect(() => {
    return combatBus.on('hurt', () => {
      pulse.current = 1;
    });
  }, []);

  useFrame((_, dt) => {
    pulse.current = Math.max(0, pulse.current - dt / 0.45);
    const m = mat.current;
    if (!m) return;
    // heartbeat throb when the hero is nearly dead
    const st = useGameStore.getState();
    const frac = st.heroMaxHp > 0 ? st.heroHp / st.heroMaxHp : 1;
    const lowHp = st.phase !== 'dead' && frac < 0.28 ? (0.22 + Math.sin(now() * 5) * 0.1) * (1 - frac / 0.28) : 0;
    m.opacity = Math.min(0.75, easeOutQuart(pulse.current) * 0.6 + lowHp);
  });

  return (
    <mesh position={[0, 1.2, 4.4]} renderOrder={20}>
      <planeGeometry args={[4.2, 3.2]} />
      <meshBasicMaterial ref={mat} map={tex} color="#c0000a" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------------- Lifesteal (crimson life drains demon → knight + emerald heal bloom) ----------------
const STEAL_N = 22;
function LifestealFX() {
  const glow = useGlowTex();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const healGlow = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useRef(
    Array.from({ length: STEAL_N }, () => ({ life: 0, max: 1, x: 0, y: 0, cx: 0, cy: 0, tx: 0, ty: 0 })),
  );
  const cursor = useRef(0);
  const heal = useRef(0);
  const crimson = useMemo(() => new THREE.Color('#ff2f4e'), []);

  useEffect(() => {
    return combatBus.on('hit', (e) => {
      if (!e.heal || e.heal < 1) return;
      heal.current = 1;
      const n = Math.min(STEAL_N, 5 + Math.round(Math.min(8, e.heal)));
      for (let i = 0; i < n; i++) {
        const p = parts.current[cursor.current];
        cursor.current = (cursor.current + 1) % STEAL_N;
        p.life = p.max = 0.45 + Math.random() * 0.25;
        p.x = IMPACT.x + (Math.random() - 0.5) * 0.6;
        p.y = IMPACT.y + (Math.random() - 0.5) * 0.6;
        p.tx = BASE_X + 0.86 + (Math.random() - 0.5) * 0.4; // knight's chest
        p.ty = 1.3 + (Math.random() - 0.5) * 0.4;
        p.cx = (p.x + p.tx) / 2 + (Math.random() - 0.5) * 0.4; // lifted arc control point
        p.cy = Math.max(p.y, p.ty) + 0.7 + Math.random() * 0.5;
      }
    });
  }, []);

  useFrame((state, dt) => {
    heal.current = Math.max(0, heal.current - dt / 0.4);
    if (healGlow.current) healGlow.current.opacity = easeOutQuart(heal.current) * 0.45;
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < STEAL_N; i++) {
      const p = parts.current[i];
      if (p.life > 0) {
        p.life -= dt;
        const u = easeInOut(clamp01(1 - p.life / p.max)); // 0 → 1 along the arc
        const inv = 1 - u;
        const px = inv * inv * p.x + 2 * inv * u * p.cx + u * u * p.tx;
        const py = inv * inv * p.y + 2 * inv * u * p.cy + u * u * p.ty;
        dummy.position.set(px, py, IMPACT.z + 0.1);
        dummy.scale.setScalar((0.13 + Math.sin(u * Math.PI) * 0.05) * clamp01(0.3 + p.life / p.max));
        dummy.quaternion.copy(state.camera.quaternion);
      } else {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, STEAL_N]} renderOrder={11}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glow} color={crimson} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* emerald heal bloom on the knight as the stolen life lands */}
      <mesh position={[BASE_X + 0.86, 1.25, 0.5]} renderOrder={11}>
        <planeGeometry args={[2.4, 2.9]} />
        <meshBasicMaterial ref={healGlow} map={glow} color="#3dff85" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---------------- HP bars ----------------
function HpBar({ x, y, frac, c }: { x: number; y: number; frac: number; c: string }) {
  const fill = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Mesh>(null); // white "recent damage" chip that trails the fill
  const cur = useRef(frac);
  const slow = useRef(frac);
  useFrame((_, dt) => {
    cur.current += (frac - cur.current) * Math.min(1, dt * 14);
    slow.current += (frac - slow.current) * Math.min(1, dt * 3);
    const set = (m: THREE.Mesh | null, f: number) => {
      if (!m) return;
      const v = Math.max(0.001, f);
      m.scale.x = v;
      m.position.x = -0.5 * (1 - v);
    };
    set(fill.current, cur.current);
    set(ghost.current, Math.max(slow.current, cur.current));
  });
  return (
    <Billboard position={[x, y, 0]}>
      <mesh renderOrder={13}>
        <planeGeometry args={[1.06, 0.15]} />
        <meshBasicMaterial color="#05030a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={ghost} position={[0, 0, 0.005]} renderOrder={14}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={fill} position={[0, 0, 0.01]} renderOrder={15}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color={c} toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

// ---------------- Camera (idle drift + shake + punch-in) ----------------
function CameraRig() {
  const { camera } = useThree();
  const shake = useRef(0);
  const kick = useRef(0);
  const base = useMemo(() => new THREE.Vector3(0, 1.8, 6.4), []);
  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      const step = COMBO[comboFor(e)];
      const big = e.double || e.crit || step.slam;
      shake.current = Math.min(0.4, shake.current + (big ? 0.24 : 0.09));
      kick.current = Math.min(0.55, kick.current + (big ? 0.42 : 0.15));
    });
    const offHurt = combatBus.on('hurt', () => {
      shake.current = Math.min(0.4, shake.current + 0.12);
    });
    const offKill = combatBus.on('kill', () => {
      shake.current = Math.min(0.4, shake.current + 0.18);
      kick.current = Math.min(0.55, kick.current + 0.3);
    });
    return () => {
      offHit();
      offHurt();
      offKill();
    };
  }, []);
  useFrame((_, dt) => {
    const t = now();
    shake.current *= Math.pow(0.002, dt);
    kick.current *= Math.pow(0.0006, dt);
    const s = shake.current;
    camera.position.set(
      base.x + Math.sin(t * 0.13) * 0.1 + (Math.random() - 0.5) * s,
      base.y + Math.sin(t * 0.17) * 0.05 + (Math.random() - 0.5) * s * 0.7,
      base.z - kick.current * 0.9,
    );
    camera.lookAt(0, 1.28, 0);
  });
  return null;
}

// ---------------- World ----------------
function World() {
  const phase = useGameStore((s) => s.phase);
  const heroClass = useGameStore((s) => s.heroClass);
  const enemyKind = useGameStore((s) => s.enemyKind);
  const heroHp = useGameStore((s) => s.heroHp);
  const heroMax = useGameStore((s) => s.heroMaxHp);
  const enemyHp = useGameStore((s) => s.enemyHp);
  const enemyMax = useGameStore((s) => s.enemyMaxHp);
  const alive = phase !== 'dead';
  const kindConf = KIND[enemyKind as EnemyKind] ?? KIND.normal;

  return (
    <>
      <color attach="background" args={['#060410']} />

      <Backdrop />
      <NebulaPulse />
      <Stars radius={70} depth={30} count={900} factor={3} saturation={0.5} fade speed={0.5} />
      <ArenaFloor />
      <Embers />

      {/* Knight renders before the FX so its hit handler advances the combo first */}
      <Knight alive={alive} />
      {alive && <Demon kind={enemyKind as EnemyKind} />}

      <HpBar x={BASE_X + 0.1} y={2.5} frac={heroMax > 0 ? heroHp / heroMax : 0} c="#37d15f" />
      {alive && (
        <HpBar x={DEMON_X} y={Math.min(DEMON_H * kindConf.scale + 0.3, 3.05)} frac={enemyMax > 0 ? enemyHp / enemyMax : 0} c="#ff3d57" />
      )}

      {alive && <SlashFX classId={heroClass as ClassId} />}
      <ImpactFlash />
      <Sparks />
      <LifestealFX />
      <HurtSlashes />
      <Shockwaves />
      <DamageNumbers />
      <HurtVignette />
      <CameraRig />
    </>
  );
}

// While AFK the frameloop is 'demand'; this ticker still requests a frame every
// UNFOCUSED_FRAME_INTERVAL_MS so the scene idles at ~10fps instead of freezing
// solid — alive behind the dim, but far cheaper than the full 60fps loop.
function AfkTicker({ afk }: { afk: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!afk) return;
    const id = setInterval(() => invalidate(), UNFOCUSED_FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [afk, invalidate]);
  return null;
}

export function Scene3D() {
  const afk = useGameStore((s) => s.afk);
  return (
    <Canvas
      className="scene"
      dpr={[1, 2]}
      frameloop={afk ? 'demand' : 'always'}
      camera={{ position: [0, 1.8, 6.4], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <AfkTicker afk={afk} />
      <Suspense fallback={null}>
        <World />
      </Suspense>
      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.85} mipmapBlur />
        <Vignette offset={0.26} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
