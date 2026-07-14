import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { combatBus, type HitEvent } from './bus';

// The hero is the user's Meshy.ai "cosmic ice knight" — a real rigged biped that
// ships WITH animation clips. Its "Triple_Combo" clip bakes THREE distinct swings,
// so we slice it into three sub-clips and play ONE per combat blow: a 3-hit burst
// reads as the full combo. Playback rate is synced to the attack cadence, and the
// separate Frostbound Blade GLB is parented to the RightHand bone. Idle = bind pose.

const BASE_X = -1.9; // hero's feet anchor (keep near Scene3D's knight anchor)
const MODEL_H = 1.7; // GLB height
const TARGET_H = 2.45;
const FACE_Y = Math.PI / 2; // bind pose faces +z (camera); turn to face the enemy (+x)

// Blade attach to the RightHand bone. The hand bone's world scale is ~0.01 (Meshy
// exports the armature at 100× down-scale), so these offsets live in that tiny
// bone-local space. The blade GLB is centred on its own origin and 1.9 units long
// on local +Y (tip at +Y, guard/grip/pommel on −Y — from a width profile of the
// mesh). Offsetting +0.7·scale on Y seats the GRIP in the fist and drops the whole
// blade below the hand so the tip hangs down (it read reversed/floating when the
// blade's mid-point sat on the bone). Verified via frozen-pose in-scene screenshots.
const BLADE = {
  pos: [0, 40, 0] as [number, number, number],
  rot: [0, 0, 0] as [number, number, number],
  scale: 55,
};

const COMBO = 'Armature|Triple_Combo_Attack|baselayer';
// The three swings inside the Triple_Combo clip (seconds; measured from the clip's
// RightForeArm angular-speed peaks at ~0.8 / 1.6 / 2.3 over its 4.37s length). Each
// slice brackets one wind-up→strike; the tail recovery is left to the fade-to-idle.
const COMBO_SEGS: Array<[number, number]> = [
  [0.0, 1.15],
  [1.15, 1.95],
  [1.95, 3.0],
];
// Where the strike LANDS within each swing, as a fraction of that swing's length —
// MEASURED numerically (the frame where the blade tip reaches its max reach toward
// the enemy, sampled via mixer.setTime over each sub-clip): 0.62 / 0.47 / 0.27.
// The hero fires a `contact` event at exactly this frame; that (not the sim's `hit`)
// is what drives every impact FX, so the damage number lands ON the blade — no more
// "the hit counts before the blade connects", regardless of cadence prediction.
const COMBO_CONTACT = [0.62, 0.47, 0.27];
const CONTACT_DELAY = 0.24; // wall-clock wind-up: sim hit → blade strikes (visible hand-rise)
const FPS = 30; // arbitrary — cancels out; subclip only uses it to map time↔frame

const DEATH_TINT = new THREE.Color('#5a6472');
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now() / 1000;

export function Hero3D({ alive }: { alive: boolean }) {
  const hero = useGLTF('/art/hero.glb');
  const combo = useGLTF('/art/hero_combo.glb');
  const blade = useGLTF('/art/blade.glb');
  const group = useRef<THREE.Group>(null);

  // slice the triple-combo into its three constituent swings, once
  const swings = useMemo(() => {
    const src = combo.animations.find((c) => c.name === COMBO) ?? combo.animations[0];
    if (!src) return [];
    return COMBO_SEGS.map(([from, to], i) =>
      THREE.AnimationUtils.subclip(src, `swing${i}`, Math.round(from * FPS), Math.round(to * FPS), FPS),
    );
  }, [combo]);
  const { actions, mixer } = useAnimations(swings, group);

  // Attach the blade once, and gather every material — persisting each material's
  // pristine base color + emissive on m.userData so a remount (useGLTF caches the
  // scene globally) re-reads the originals instead of an already-tinted value. The
  // baked emissive is the ice-glow, so hurt only *adds* a red flash on top of it.
  const mats = useMemo(() => {
    const hand = hero.scene.getObjectByName('RightHand') as THREE.Object3D | null;
    if (hand && !hand.getObjectByName('frostblade')) {
      const b = blade.scene.clone(true);
      b.name = 'frostblade';
      b.position.set(...BLADE.pos);
      b.rotation.set(...BLADE.rot);
      b.scale.setScalar(BLADE.scale);
      hand.add(b);
    }
    const list: Array<{ m: THREE.MeshStandardMaterial; base: THREE.Color; emis: THREE.Color }> = [];
    hero.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const arr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of arr as THREE.MeshStandardMaterial[]) {
        if (list.some((e) => e.m === m)) continue;
        const base = (m.userData.baseColor ??= m.color.clone()) as THREE.Color;
        const emis = (m.userData.baseEmissive ??= m.emissive.clone()) as THREE.Color;
        list.push({ m, base, emis });
      }
    });
    return list;
  }, [hero.scene, blade.scene]);

  const state = useRef({ last: -99, period: 1.1, idx: 0 });
  const queue = useRef<Array<{ at: number; e: HitEvent }>>([]); // pending blade-contacts (FIFO)
  const hurt = useRef(0);
  const deathRot = useRef(0);

  // when a swing finishes, ease it out so the hero settles back to the bind pose
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => e.action.fadeOut(0.3);
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer]);

  // On a sim 'hit' we react at once: play the next combo swing and arm a `contact`
  // to fire when the blade actually reaches its strike frame (COMBO_CONTACT into the
  // swing). Every impact FX rides `contact`, so the damage number/spark/knockback
  // land ON the blade — the sim hit only drives the swing + HP, never the visible hit.
  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      const s = state.current;
      const t = now();
      const delta = t - s.last;
      // guard tiny deltas too: the sim can emit several hits in one frame (catch-up
      // steps / 2–3× speed), which would otherwise crush the EMA toward zero
      if (delta > 0.01 && delta < 3) s.period = s.period * 0.6 + delta * 0.4;
      s.last = t;
      const i = s.idx % 3;
      s.idx++;
      const a = actions[`swing${i}`];
      if (!a) return;
      const span = a.getClip().duration;
      // Wind-up before the strike: a readable ~CONTACT_DELAY, but always well under the
      // attack interval so fast tempos (ranger / 2–3× speed) stay in sync and the
      // contact queue never backs up. playback ≤ period keeps consecutive swings from
      // piling on top of each other.
      const target = Math.min(CONTACT_DELAY, s.period * 0.55);
      const playback = clamp(target / COMBO_CONTACT[i], 0.16, Math.min(span, s.period));
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.timeScale = span / playback;
      // blend in smoothly (a hard 0.05 snapped); the previous swing crossfades out, so
      // the combo flows 0→1→2 instead of jumping between poses
      a.fadeIn(0.16).play();
      for (const other of Object.values(actions)) if (other && other !== a) other.fadeOut(0.2);
      queue.current.push({ at: t + COMBO_CONTACT[i] * playback, e });
    });
    const offHurt = combatBus.on('hurt', (ev) => {
      if (!ev.miss) hurt.current = 1;
    });
    return () => {
      offHit();
      offHurt();
    };
  }, [actions]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Fire each pending blade-contact when its swing reaches the strike frame — this
    // is what every impact FX listens to, so they land exactly on the blade. Drain in
    // FIFO order so no hit's FX is ever dropped, even when several are due at once.
    const q = queue.current;
    const t = now();
    while (q.length && t >= q[0].at) {
      const { e } = q.shift()!;
      if (alive) combatBus.emit('contact', e);
    }

    hurt.current = Math.max(0, hurt.current - dt / 0.3);
    const flinch = 1 - Math.pow(1 - hurt.current, 4);

    if (alive) {
      g.position.y += (0 - g.position.y) * Math.min(1, dt * 5);
      deathRot.current += (0 - deathRot.current) * Math.min(1, dt * 5);
      g.rotation.z = deathRot.current;
      for (const { m, base, emis } of mats) {
        // keep the baked ice-glow, add a red-ish flash on top while hurt
        m.emissive.setRGB(emis.r + flinch * 0.5, emis.g + flinch * 0.05, emis.b + flinch * 0.05);
        m.color.lerp(base, Math.min(1, dt * 2.5)); // un-drain after a rebirth
      }
    } else {
      // death: stop attacking, keel over, drain color, kill the glow
      q.length = 0; // drop any pending contacts so no FX fire past death
      for (const a of Object.values(actions)) a?.fadeOut(0.2);
      deathRot.current += (-1.3 - deathRot.current) * Math.min(1, dt * 3);
      g.rotation.z = deathRot.current;
      g.position.y += (0.2 - g.position.y) * Math.min(1, dt * 3);
      for (const { m } of mats) {
        m.color.lerp(DEATH_TINT, Math.min(1, dt * 2));
        m.emissive.setRGB(0, 0, 0);
      }
    }
  });

  return (
    <group ref={group} position={[BASE_X, 0, 0]}>
      <group rotation-y={FACE_Y} scale={TARGET_H / MODEL_H}>
        <primitive object={hero.scene} />
      </group>
    </group>
  );
}

/** Lights for the PBR GLB assets (hero, blade, enemy, arena) — the sprite/FX
 *  layers are all unlit MeshBasicMaterial, so these only touch the models. */
export function TrialLights() {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} color="#fff2dd" />
      <directionalLight position={[-3, 2, -2]} intensity={0.9} color="#9ab8ff" />
    </>
  );
}

useGLTF.preload('/art/hero.glb');
useGLTF.preload('/art/hero_combo.glb');
useGLTF.preload('/art/blade.glb');
