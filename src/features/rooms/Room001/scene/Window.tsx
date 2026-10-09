import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, PlaneGeometry } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { player } from '@/features/hub/playerState';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { ROOM, WINDOW } from '../layout';
import { useR1 } from '../useRoom001';
import { createFogWindowMaterial } from '../shaders/fogWindow';

const FRAME = '#e3d6bb';
const DEPTH = 0.16; // wall thickness at the reveal

/** Pleated curtain: a plane with sinusoidal folds baked into Z. */
function useCurtainGeometry(w: number, h: number) {
  const geo = useMemo(() => {
    const g = new PlaneGeometry(w, h, 48, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, 0.035 * Math.sin((x / w) * Math.PI * 2 * 5) + 0.01 * Math.sin(x * 37));
    }
    g.computeVertexNormals();
    return g;
  }, [w, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** Window onto the fog: frame, mullions, glass, reveal, curtains, and the fog shader plane. */
export function Window() {
  const { levels } = useR1();
  const fog = useMemo(createFogWindowMaterial, []);
  useEffect(() => () => fog.dispose(), [fog]);
  const curtain = useCurtainGeometry(0.62, 2.48);

  // The fog only drifts while you move.
  useFrame((_, dt) => {
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    fog.uniforms.uTime.value += dt * (0.015 + speed * 0.55);
    fog.uniforms.uDark.value = 1 - levels.lamp;
    fog.uniforms.uFade.value = 1 - levels.exit;
  });

  const { x, y, w, h } = WINDOW;
  const z = ROOM.z0;
  const look = () => {
    sfx.creak([x, y, z], 0.08);
    ui().showToast('Le brouillard ne bouge pas. Il vous regarde bouger.');
  };

  return (
    <group>
      {/* Fog beyond the glass (slightly larger than the opening for parallax). */}
      <mesh position={[x, y, z - 0.9]} material={fog}>
        <planeGeometry args={[w * 2.4, h * 2.2]} />
      </mesh>

      {/* Reveal (jambs, head, sill) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + (s * w) / 2, y, z - DEPTH / 2]} rotation-y={-s * (Math.PI / 2)}>
          <planeGeometry args={[DEPTH, h]} />
          <meshStandardMaterial color={FRAME} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[x, y + h / 2, z - DEPTH / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, DEPTH]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      <mesh position={[x, y - h / 2 - 0.02, z + 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.2, 0.04, DEPTH + 0.16]} />
        <meshStandardMaterial color={FRAME} roughness={0.5} />
      </mesh>

      <Interactable label="Regarder dehors" distance={3.2} onInteract={look}>
        {/* Glass: barely there, a cold sheen. */}
        <mesh position={[x, y, z - DEPTH + 0.02]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#9fb4c8" transparent opacity={0.1} roughness={0.05} metalness={0.8} depthWrite={false} />
        </mesh>
        {/* Casement frame + mullions (they cast the cross shadow on the carpet). */}
        <group position={[x, y, z - DEPTH + 0.04]}>
          {[
            [0, h / 2 - 0.03, w, 0.06],
            [0, -h / 2 + 0.03, w, 0.06],
            [-w / 2 + 0.03, 0, 0.06, h],
            [w / 2 - 0.03, 0, 0.06, h],
            [0, 0, 0.045, h],
            [0, h * 0.18, w, 0.04],
          ].map(([px, py, sx, sy], i) => (
            <mesh key={i} position={[px, py, 0]} castShadow>
              <boxGeometry args={[sx, sy, 0.05]} />
              <meshStandardMaterial color={FRAME} roughness={0.6} />
            </mesh>
          ))}
          {/* Latch */}
          <mesh position={[0.04, -0.05, 0.035]}>
            <boxGeometry args={[0.02, 0.08, 0.02]} />
            <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      </Interactable>

      {/* Curtains, rod and valance */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={curtain} position={[x + s * (w / 2 + 0.24), 1.3, z + 0.09]} castShadow receiveShadow>
          <meshStandardMaterial color="#6b2c1a" roughness={1} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[x, 2.56, z + 0.1]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, w + 1.4, 10]} />
        <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[x, 2.5, z + 0.14]} castShadow>
        <boxGeometry args={[w + 1.3, 0.2, 0.05]} />
        <meshStandardMaterial color="#5a2416" roughness={0.9} />
      </mesh>
    </group>
  );
}
