import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { AdditiveBlending, MeshStandardMaterial, type Group, type SpriteMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { FONT_DISPLAY } from '@/lib/loaders/fonts';
import { glow } from '@/lib/textures/procedural';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { FRAGMENT_POS } from './layout';
import { useRoom042 } from './state';

/**
 * Fragment « 2 »: a brass key-tag half sunk in the silt under the bed.
 * Invisible until the fish has led you here (its light "finds" it).
 */
export function KeyFragment({ onTake }: { onTake: () => void }) {
  const phase = useRoom042((s) => s.phase);
  const [taken, setTaken] = useState(false);
  const group = useRef<Group>(null);
  const halo = useRef<SpriteMaterial>(null);
  const reveal = useRef(0);
  const brass = useMemo(
    () => new MeshStandardMaterial({ color: '#c99a46', metalness: 0.85, roughness: 0.35, emissive: '#7a4a10', emissiveIntensity: 0, transparent: true, opacity: 0 }),
    [],
  );
  const haloTex = useMemo(() => glow('#f1c97a'), []);
  const active = phase === 'reveal' && !taken;

  useFrame(({ clock }, dt) => {
    const target = active ? 1 : 0;
    reveal.current += (target - reveal.current) * (1 - Math.exp(-dt * (active ? 1.2 : 4)));
    const k = reveal.current;
    const t = clock.elapsedTime;
    brass.opacity = k;
    brass.emissiveIntensity = k * (1.2 + Math.sin(t * 2.2) * 0.4);
    if (halo.current) halo.current.opacity = k * (0.5 + Math.sin(t * 2.2) * 0.15);
    if (group.current) {
      group.current.visible = k > 0.01;
      // Silt stirs: it rocks a little.
      group.current.rotation.z = Math.sin(t * 0.9) * 0.08 * k;
    }
  });

  return (
    <group ref={group} position={FRAGMENT_POS} visible={false}>
      <Interactable
        label="Prendre le fragment"
        distance={2.4}
        disabled={!active}
        onInteract={() => {
          setTaken(true);
          sfx.bubbles([FRAGMENT_POS[0], 0.3, FRAGMENT_POS[2]], 0.6);
          useRoom042.getState().set({ phase: 'taken' });
          ui().setHint(null);
          onTake();
        }}
      >
        <group rotation={[-Math.PI / 2 + 0.25, 0, 0.4]}>
          <mesh material={brass}>
            <boxGeometry args={[0.15, 0.22, 0.015]} />
          </mesh>
          <mesh position={[0, 0.085, 0.009]}>
            <ringGeometry args={[0.014, 0.024, 12]} />
            <meshBasicMaterial color="#1a1208" />
          </mesh>
          <Text font={FONT_DISPLAY} fontSize={0.12} position={[0, -0.02, 0.009]} anchorX="center" anchorY="middle" fillOpacity={1}>
            2
            <meshStandardMaterial color="#ffe2a0" emissive="#ffb347" emissiveIntensity={2.6} toneMapped={false} />
          </Text>
        </group>
        {/* Generous invisible hit volume so the small tag is easy to target. */}
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.24, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <sprite position={[0, 0.06, 0]} scale={[0.7, 0.7, 0.7]}>
        <spriteMaterial ref={halo} map={haloTex} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} fog={false} />
      </sprite>
    </group>
  );
}
