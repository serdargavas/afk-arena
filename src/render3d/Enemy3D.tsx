import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { combatBus } from './bus';
import type { EnemyKind } from '../game/types';

// The enemy is the user's Meshy.ai "Female Draconic Warrior" — a static posed GLB
// (no rig/clips), so like the old sprite demon it stands its ground and only
// reacts to blows it takes: hit flash + knockback + squash, plus a spawn pop.

const DEMON_X = 1.62; // matches Scene3D's enemy anchor
const FEET = 0.95; // model-space offset to drop the feet to y=0 (GLB is y −0.95..+0.95)
const FACE_Y = -Math.PI / 2; // turn to face the hero (−x)
const KIND_SCALE: Record<EnemyKind, number> = { normal: 1.25, elite: 1.4, boss: 1.6 };
const BRUISE = new THREE.Color('#ff5a4a');
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export function Enemy3D({ kind }: { kind: EnemyKind }) {
  const gltf = useGLTF('/art/enemy.glb');
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const kb = useRef(0);
  const squash = useRef(0);
  const flash = useRef(0);
  const pop = useRef(0);
  const scale = KIND_SCALE[kind] ?? KIND_SCALE.normal;

  const mats = useMemo(() => {
    const list: Array<{ m: THREE.MeshStandardMaterial; base: THREE.Color; emis: THREE.Color }> = [];
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const arr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of arr as THREE.MeshStandardMaterial[]) {
        if (list.some((e) => e.m === m)) continue;
        // persist pristine base/emissive on the material — the enemy unmounts on
        // death (shared useGLTF cache), so re-read the originals, not a mid-flash tint
        const base = (m.userData.baseColor ??= m.color.clone()) as THREE.Color;
        const emis = (m.userData.baseEmissive ??= m.emissive.clone()) as THREE.Color;
        list.push({ m, base, emis });
      }
    });
    return list;
  }, [gltf.scene]);

  useEffect(() => {
    const offHit = combatBus.on('hit', (e) => {
      if (e.miss) return; // a whiff lands nothing — no knockback/flash/squash
      flash.current = 1;
      kb.current = e.double ? 0.9 : e.crit ? 0.65 : 0.42;
      squash.current = 1;
    });
    const offKill = combatBus.on('kill', () => {
      pop.current = 1;
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
    kb.current *= Math.pow(0.002, dt);
    squash.current = Math.max(0, squash.current - dt / 0.18);
    flash.current = Math.max(0, flash.current - dt / 0.12);
    pop.current = Math.max(0, pop.current - dt / 0.4);

    const sq = easeOutQuart(squash.current);
    const f = easeOutQuart(flash.current);
    const spawn = 0.55 + 0.45 * easeOutBack(1 - pop.current);

    // stands its ground — the only motion is reacting to a blow it just took
    g.position.x = DEMON_X + kb.current;
    g.rotation.z = kb.current * 0.28;
    bd.scale.set(scale * (1 + sq * 0.14) * spawn, scale * (1 - sq * 0.18) * spawn, scale * spawn);

    for (const { m, base, emis } of mats) {
      m.color.copy(base).lerp(BRUISE, f * 0.4);
      m.emissive.copy(emis).addScalar(f * 0.5);
    }
  });

  return (
    <group ref={group} position={[DEMON_X, 0, 0]}>
      <group ref={body} scale={scale}>
        <group rotation-y={FACE_Y} position={[0, FEET, 0]}>
          <primitive object={gltf.scene} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload('/art/enemy.glb');
