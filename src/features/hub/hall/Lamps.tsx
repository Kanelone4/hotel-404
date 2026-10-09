import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial, PointLight } from 'three';
import { HALL } from './layout';

const POSITIONS: [number, number][] = [
  [-2.2, -6],
  [2.2, -6],
  [-2.2, -1],
  [2.2, -1],
  [-2.2, 4],
  [2.2, 4],
];

/**
 * Six pendant globes; only four carry real point lights (cost control),
 * all glow through bloom. `flicker` = index of a lamp that misbehaves
 * (after room 237). `tint` shifts every bulb toward red (after all fragments).
 */
export function Lamps({ flicker, tint }: { flicker: number | null; tint: boolean }) {
  const lights = useRef<(PointLight | null)[]>([]);
  const mats = useRef<(MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    POSITIONS.forEach((_, i) => {
      let k = 1;
      if (i === flicker) {
        const n = Math.sin(t * 23) * Math.sin(t * 7.3) * Math.sin(t * 1.1);
        k = n > 0.25 ? 0.05 : 1;
      }
      const m = mats.current[i];
      if (m) m.emissiveIntensity = 2.4 * k;
      const l = lights.current[i];
      if (l) l.intensity = 9 * k;
    });
  });

  const color = tint ? '#ff8a70' : '#ffcf8a';
  return (
    <group>
      {POSITIONS.map(([x, z], i) => (
        <group key={i} position={[x, HALL.height, z]}>
          <mesh position={[0, -0.45, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.9]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, -0.95, 0]}>
            <sphereGeometry args={[0.2, 24, 16]} />
            <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color="#fff6e0" emissive={color} emissiveIntensity={2.4} roughness={0.3} />
          </mesh>
          {i % 3 !== 1 && (
            <pointLight ref={(l) => (lights.current[i] = l)} position={[0, -1.1, 0]} intensity={9} distance={9} decay={1.6} color={color} />
          )}
        </group>
      ))}
    </group>
  );
}
