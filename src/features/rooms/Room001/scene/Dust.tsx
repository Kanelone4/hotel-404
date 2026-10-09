import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type PointsMaterial } from 'three';
import { rng } from '@/lib/textures/procedural';
import { useQuality } from '@/lib/fx/quality';
import { useR1 } from '../useRoom001';

/** Slow dust motes hanging in the lamp light / moonbeam. CPU-updated, a few hundred points. */
export function Dust() {
  const { particles } = useQuality();
  const { levels } = useR1();
  const mat = useRef<PointsMaterial>(null);
  const count = Math.round(220 * particles);

  const { geo, base, phase } = useMemo(() => {
    const r = rng(404);
    const base = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base[i * 3] = -2.3 + r() * 3.4;
      base[i * 3 + 1] = 0.3 + r() * 2.2;
      base[i * 3 + 2] = -2.9 + r() * 3.2;
      phase[i] = r() * Math.PI * 2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(base.slice(), 3));
    return { geo, base, phase };
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    const p = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < count; i++) {
      const ph = phase[i];
      p.setXYZ(
        i,
        base[i * 3] + Math.sin(t + ph) * 0.12,
        base[i * 3 + 1] + Math.sin(t * 0.7 + ph * 1.3) * 0.08,
        base[i * 3 + 2] + Math.cos(t * 0.8 + ph) * 0.12,
      );
    }
    p.needsUpdate = true;
    if (mat.current) mat.current.opacity = (0.18 + 0.32 * levels.lamp * levels.flicker) * (1 - levels.exit);
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        ref={mat}
        size={0.012}
        sizeAttenuation
        color="#ffe2b0"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
