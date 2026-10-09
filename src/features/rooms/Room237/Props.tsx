import { useLayoutEffect, useMemo, useRef } from 'react';
import { DoubleSide, Object3D, type InstancedMesh } from 'three';
import { RoundedBox } from '@react-three/drei';
import { wood, noiseMap, rng } from '@/lib/textures/procedural';
import { mattress } from './textures';

/** Overturned, abandoned furniture of the bedroom. Static, shadow-casting. */
export function Props() {
  const tex = useMemo(
    () => ({
      wood: wood([1, 1], '#3d2716', 23),
      woodPale: wood([1, 1], '#5a4128', 24),
      fabric: noiseMap([2, 2], 16, 41),
      mattress: mattress(),
    }),
    [],
  );

  return (
    <group>
      {/* Mattress dragged off the bed, lying askew under the inscription */}
      <group position={[-1.8, 0.11, -1.95]} rotation-y={0.22}>
        <RoundedBox args={[1.4, 0.22, 1.95]} radius={0.06} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial map={tex.mattress} roughness={1} />
        </RoundedBox>
      </group>

      {/* Bed frame flipped against the west wall, slats broken */}
      <group position={[-3.05, 0, -1.9]} rotation-y={0.04}>
        <mesh position={[0.2, 0.75, 0]} rotation-z={1.32} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.08, 2.0]} />
          <meshStandardMaterial map={tex.wood} roughness={0.8} />
        </mesh>
        {[-0.7, -0.2, 0.35].map((z, i) => (
          <mesh key={i} position={[0.55 + i * 0.12, 0.05, z]} rotation={[0, 0.4 * i, 0.1]} castShadow>
            <boxGeometry args={[0.9 - i * 0.2, 0.03, 0.08]} />
            <meshStandardMaterial map={tex.woodPale} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Wardrobe lying on its back, one door torn off */}
      <group position={[-2.35, 0.3, 1.35]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.6, 1.0]} />
          <meshStandardMaterial map={tex.wood} roughness={0.75} />
        </mesh>
        <mesh position={[0.45, 0.305, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshStandardMaterial color="#090605" />
        </mesh>
        <mesh position={[0.6, -0.27, -0.95]} rotation={[0, 0.5, 0.05]} castShadow>
          <boxGeometry args={[0.9, 0.03, 0.48]} />
          <meshStandardMaterial map={tex.woodPale} roughness={0.8} />
        </mesh>
      </group>

      {/* Armchair on its side */}
      <group position={[0.9, 0.4, -0.3]} rotation={[0, 0.6, Math.PI / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.75, 0.38, 0.75]} />
          <meshStandardMaterial color="#3c4433" roughnessMap={tex.fabric} roughness={1} />
        </mesh>
        <mesh position={[0, 0.35, -0.32]} castShadow>
          <boxGeometry args={[0.75, 0.6, 0.12]} />
          <meshStandardMaterial color="#353d2d" roughness={1} />
        </mesh>
        {[-0.33, 0.33].map((x) => (
          <mesh key={x} position={[x, 0.24, 0.02]} castShadow>
            <boxGeometry args={[0.1, 0.22, 0.72]} />
            <meshStandardMaterial color="#353d2d" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Dresser, drawers yanked out */}
      <group position={[1.7, 0, 1.0]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.15, 1.0, 0.48]} />
          <meshStandardMaterial map={tex.wood} roughness={0.7} />
        </mesh>
        {[0.25, 0.55, 0.82].map((y, i) => (
          <mesh key={y} position={[i === 1 ? 0.1 : 0, y, 0.25 + (i === 1 ? 0.18 : 0)]} rotation-y={i === 1 ? 0.05 : 0} castShadow>
            <boxGeometry args={[1.0, 0.22, i === 1 ? 0.45 : 0.03]} />
            <meshStandardMaterial map={tex.woodPale} roughness={0.75} />
          </mesh>
        ))}
        {/* Fallen drawer */}
        <mesh position={[-0.25, 0.1, 0.9]} rotation={[0.2, 0.9, 1.4]} castShadow>
          <boxGeometry args={[0.9, 0.2, 0.42]} />
          <meshStandardMaterial map={tex.woodPale} roughness={0.75} />
        </mesh>
      </group>

      {/* Nightstand tipped forward + lamp */}
      <group position={[-0.32, 0.22, -2.6]} rotation={[1.35, 0.3, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.48, 0.55, 0.4]} />
          <meshStandardMaterial map={tex.wood} roughness={0.75} />
        </mesh>
      </group>
      <group position={[0.35, 0.12, -2.2]} rotation={[0, 0.7, Math.PI / 2 - 0.15]}>
        <mesh castShadow>
          <coneGeometry args={[0.16, 0.22, 16, 1, true]} />
          <meshStandardMaterial color="#7d6f55" side={DoubleSide} roughness={1} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.35, 6]} />
          <meshStandardMaterial color="#5c4a2a" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* Chair left in the middle of the room */}
      <group position={[-0.95, 0, 0.25]} rotation={[0, 2.4, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.42, 0.04, 0.42]} />
          <meshStandardMaterial map={tex.woodPale} />
        </mesh>
        <mesh position={[0, 0.72, -0.19]} castShadow>
          <boxGeometry args={[0.42, 0.5, 0.03]} />
          <meshStandardMaterial map={tex.woodPale} />
        </mesh>
        {[
          [-0.18, -0.18],
          [0.18, -0.18],
          [-0.18, 0.18],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.22, z]} castShadow>
            <boxGeometry args={[0.035, 0.44, 0.035]} />
            <meshStandardMaterial map={tex.wood} />
          </mesh>
        ))}
      </group>

      <Debris />
    </group>
  );
}

const dummy = new Object3D();

/** Plaster chunks and scattered papers (instanced: 2 draw calls). */
function Debris() {
  const chunks = useRef<InstancedMesh>(null);
  const papers = useRef<InstancedMesh>(null);
  const N_CHUNKS = 46;
  const N_PAPERS = 28;

  useLayoutEffect(() => {
    const r = rng(99);
    const c = chunks.current;
    if (c) {
      for (let i = 0; i < N_CHUNKS; i++) {
        // Mostly against walls (fallen plaster), some under the inscription.
        const near = i < 14;
        const x = near ? -1.6 + (r() - 0.5) * 1.6 : -3.3 + r() * 5.1;
        const z = near ? -2.85 + r() * 0.35 : r() < 0.5 ? -2.9 + r() * 0.3 : 1.6 + r() * 0.3;
        const s = 0.02 + r() * 0.06;
        dummy.position.set(x, s * 0.4, z);
        dummy.rotation.set(r() * 3, r() * 3, r() * 3);
        dummy.scale.set(s * (1 + r()), s, s * (1 + r()));
        dummy.updateMatrix();
        c.setMatrixAt(i, dummy.matrix);
      }
      c.instanceMatrix.needsUpdate = true;
    }
    const p = papers.current;
    if (p) {
      for (let i = 0; i < N_PAPERS; i++) {
        const inBath = i > 23;
        dummy.position.set(inBath ? 2.3 + r() * 1.2 : -3.2 + r() * 4.8, 0.004 + i * 0.0004, inBath ? -2.8 + r() * 2 : -2.6 + r() * 4.2);
        dummy.rotation.set(-Math.PI / 2, 0, r() * Math.PI * 2);
        const s = 0.18 + r() * 0.12;
        dummy.scale.set(s, s * 1.3, 1);
        dummy.updateMatrix();
        p.setMatrixAt(i, dummy.matrix);
      }
      p.instanceMatrix.needsUpdate = true;
    }
  }, []);

  return (
    <>
      <instancedMesh ref={chunks} args={[undefined, undefined, N_CHUNKS]} castShadow receiveShadow raycast={() => null}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8d8574" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={papers} args={[undefined, undefined, N_PAPERS]} receiveShadow raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#9b9177" roughness={1} />
      </instancedMesh>
    </>
  );
}
