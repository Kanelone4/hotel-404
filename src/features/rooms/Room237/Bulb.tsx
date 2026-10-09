import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, MeshStandardMaterial, PointLight } from 'three';
import { Spatial } from '@/lib/audio/Sound';
import { neonHum } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { bulbState, sharedUniforms } from './state';
import { H } from './layout';

/**
 * Bare ceiling bulb on a wire. Normal motion: nervous flutter + short
 * outages. Reduced motion: slow breathing dimming only (no strobe).
 * `dead` = exit sequence.
 */
export function Bulb({ dead, reducedMotion }: { dead: boolean; reducedMotion: boolean }) {
  const swing = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const s = useRef({ out: 0, nextOut: 5, level: 1 });
  const [bx, by, bz] = bulbState.pos.toArray();

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const st = s.current;
    let k: number;
    if (dead) k = 0;
    else if (reducedMotion) k = 0.7 + 0.3 * Math.sin(t * 0.6) * Math.sin(t * 0.27);
    else {
      k = 0.88 + 0.12 * Math.sin(t * 31) * Math.sin(t * 7.7);
      st.nextOut -= dt;
      if (st.nextOut <= 0) {
        st.out = 0.25 + Math.random() * 1.1;
        st.nextOut = 4 + Math.random() * 10;
        if (Math.random() < 0.5) sfx.buzz([bx, by, bz], 0.06);
      }
      if (st.out > 0) {
        st.out -= dt;
        const n = Math.sin(t * 47) * Math.sin(t * 13.1) + Math.sin(t * 5.3) * 0.5;
        k = n > 0.2 ? 0.03 : 0.55;
      }
    }
    st.level += (k - st.level) * (1 - Math.exp(-dt * (reducedMotion ? 6 : 40)));
    bulbState.level = st.level;
    sharedUniforms.uBulb.value = st.level;
    if (light.current) light.current.intensity = 3.2 * st.level;
    if (mat.current) mat.current.emissiveIntensity = 5 * st.level;
    if (swing.current && !reducedMotion) {
      swing.current.rotation.z = Math.sin(t * 0.8) * 0.025;
      swing.current.rotation.x = Math.sin(t * 0.55 + 1) * 0.018;
    }
  });

  const wire = H - by;
  return (
    <group ref={swing} position={[bx, H, bz]}>
      <mesh position={[0, -wire / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, wire, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, -wire - 0.02, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 0.06, 12]} />
        <meshStandardMaterial color="#2a241c" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, -wire - 0.08, 0]} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial ref={mat} color="#fff1d0" emissive="#ffb35c" emissiveIntensity={5} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, -wire - 0.12, 0]} color="#ffb76a" intensity={3.2} distance={7} decay={1.8} />
      <Spatial sound={neonHum({ gain: 0.05, freq: 50 })} position={[0, -wire, 0]} volume={dead ? 0 : 0.5} refDistance={0.6} />
    </group>
  );
}
