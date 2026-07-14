import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Trial arena: the user's Meshy.ai "Emberstone Ruins" diorama (public/art/arena.glb).
// It's a walled ruin courtyard (~1.5×1.9×1.45 normalized units, main floor at
// y≈-0.62, grand arched facade at -z, crumbled low wall at +z) — scaled up so
// the fighters stand on the courtyard floor and the camera looks in over the
// broken front wall. Replaces the painted Backdrop/ArenaFloor when enabled.

const S = 5.5; // model → world scale
const FLOOR_Y = -0.62; // courtyard floor in model units
const OFFSET = { x: 0.45, z: -0.8 }; // centers the open fight area on the origin
const YAW = -0.35; // turn the ruin so the hero stands in the OPEN courtyard, clear of
// the side wall (rotating the other way, +yaw, tucked him further behind it)

export function Arena3D() {
  const gltf = useGLTF('/art/arena.glb');
  useMemo(() => {
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.frustumCulled = true;
        const m = o.material as THREE.MeshStandardMaterial;
        m.side = THREE.FrontSide; // interior walls stay visible; halves the fill cost
      }
    });
  }, [gltf.scene]);

  return (
    <group position={[OFFSET.x, -FLOOR_Y * S, OFFSET.z]} rotation-y={YAW} scale={S}>
      <primitive object={gltf.scene} />
    </group>
  );
}

useGLTF.preload('/art/arena.glb');
