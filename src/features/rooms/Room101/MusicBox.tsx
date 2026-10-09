import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Group, PointLight } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { Spatial } from '@/lib/audio/Sound';
import { FONT_DISPLAY } from '@/lib/loaders/fonts';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import type { MusicBoxControl } from './audio';
import { fx } from './state';
import { MUSIC_BOX } from './layout';

interface Props {
  ctl: MusicBoxControl;
  /** Puzzle solved: the lid opens and the fragment rises. */
  open: boolean;
  taken: boolean;
  onTake: () => void;
}

/** Wooden music box: crank turning with the tune, lid with a tiny ballerina — or the key fragment "0". */
export function MusicBox({ ctl, open, taken, onTake }: Props) {
  const lid = useRef<Group>(null);
  const crank = useRef<Group>(null);
  const frag = useRef<Group>(null);
  const fragLight = useRef<PointLight>(null);
  const rise = useRef(0);

  useFrame(({ clock }, dt) => {
    const alive = 1 - fx.dying;
    if (crank.current && alive > 0) crank.current.rotation.x -= dt * 1.4 * ctl.rate;
    if (lid.current) {
      const target = open ? -1.9 : 0;
      lid.current.rotation.x += (target - lid.current.rotation.x) * (1 - Math.exp(-dt * 2.5));
    }
    if (open) rise.current = Math.min(1, rise.current + dt * 0.35);
    if (frag.current) {
      const t = clock.elapsedTime;
      const e = rise.current * rise.current * (3 - 2 * rise.current);
      frag.current.position.y = 0.06 + e * 0.32 + (fx.reducedMotion ? 0 : Math.sin(t * 1.6) * 0.012 * e);
      frag.current.rotation.y = fx.reducedMotion ? 0.4 : t * 0.7;
      frag.current.visible = open && !taken;
    }
    if (fragLight.current) fragLight.current.intensity = open && !taken ? 0.8 * rise.current : 0;
  });

  const [x, y, z] = MUSIC_BOX;
  return (
    <group position={[x, y, z]}>
      <Spatial sound={ctl.factory} position={[0, 0.08, 0]} volume={0.55} refDistance={0.9} rolloff={1.2} />
      <Interactable
        label="La boîte à musique"
        distance={2.2}
        onInteract={() => {
          sfx.click([x, y + 0.05, z], 0.3);
          ui().showToast(
            open
              ? 'Elle joue toute seule. Personne ne l’a remontée.'
              : fx.uneaseOn
                ? 'Vous ne l’avez jamais remontée. Elle ralentit quand même.'
                : '« Au clair de la lune ». Le couvercle ne s’ouvre pas. Il attend quelque chose.',
          );
        }}
      >
        {/* Box */}
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.09, 0.13]} />
          <meshStandardMaterial color="#b98a5a" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.045, 0.0655]}>
          <planeGeometry args={[0.14, 0.05]} />
          <meshStandardMaterial color="#efc4cf" roughness={0.6} />
        </mesh>
        {/* Lid, hinged at the back */}
        <group ref={lid} position={[0, 0.09, -0.065]}>
          <mesh position={[0, 0.008, 0.065]} castShadow>
            <boxGeometry args={[0.185, 0.016, 0.135]} />
            <meshStandardMaterial color="#a8794a" roughness={0.45} />
          </mesh>
          <mesh position={[0, -0.001, 0.065]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.15, 0.1]} />
            <meshStandardMaterial color="#c9d6e6" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
        {/* Crank on the side */}
        <group ref={crank} position={[0.095, 0.045, 0]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.005, 0.005, 0.02, 6]} />
            <meshStandardMaterial color="#c9a45a" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.012, 0.015, 0]}>
            <boxGeometry args={[0.005, 0.035, 0.008]} />
            <meshStandardMaterial color="#c9a45a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      </Interactable>

      {/* Fragment "0" */}
      <group ref={frag} visible={false}>
        <Interactable label="Prendre le fragment « 0 »" distance={2.4} disabled={!open || taken} onInteract={onTake}>
          <Text font={FONT_DISPLAY} fontSize={0.16} anchorX="center" anchorY="middle">
            0
            <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={2.4} toneMapped={false} side={2} />
          </Text>
          <mesh visible={false}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial />
          </mesh>
        </Interactable>
        <pointLight ref={fragLight} color="#ffc070" intensity={0} distance={1.6} decay={2} />
      </group>
    </group>
  );
}
