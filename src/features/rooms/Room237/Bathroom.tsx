import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import type { Group, PointLight } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { FONT_DISPLAY } from '@/lib/loaders/fonts';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { wood, noiseMap } from '@/lib/textures/procedural';
import { BATH_DOOR, TUB, FRAGMENT_POS } from './layout';
import { brokenMirror } from './textures';

const DOOR_AJAR = 0.6;
const DOOR_OPEN = 1.62;

export interface BathroomProps {
  doorOpen: boolean;
  onOpenDoor: () => void;
  /** Inscription has been read: the tub apron can be pried off. */
  knowsWhere: boolean;
  apronOpen: boolean;
  onOpenApron: () => void;
  taken: boolean;
  onTake: () => void;
}

/** Bathroom behind the half-open door: tub of black water, broken mirror, the hidden fragment. */
export function Bathroom(p: BathroomProps) {
  const tex = useMemo(() => ({ door: wood([1, 2], '#4a3a2a', 51), grime: noiseMap([2, 2], 20, 77), mirror: brokenMirror() }), []);
  return (
    <group>
      <BathDoor open={p.doorOpen} onOpen={p.onOpenDoor} tex={tex.door} />
      <Tub {...p} grime={tex.grime} />
      {/* Sink on its pedestal */}
      <group position={[3.2, 0, -0.6]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.11, 0.8, 16]} />
          <meshStandardMaterial color="#b9b5a6" roughness={0.5} roughnessMap={tex.grime} />
        </mesh>
        <RoundedBox args={[0.55, 0.16, 0.38]} radius={0.05} position={[0, 0.86, 0.02]} castShadow receiveShadow>
          <meshStandardMaterial color="#c9c4b2" roughness={0.35} roughnessMap={tex.grime} />
        </RoundedBox>
        <mesh position={[0, 0.945, 0.04]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.15, 24]} />
          <meshStandardMaterial color="#2a2418" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.0, 0.17]} rotation-x={0.5}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
          <meshStandardMaterial color="#6c5e3e" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      {/* Broken mirror */}
      <group position={[3.2, 1.55, -0.415]} rotation-y={Math.PI}>
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[0.66, 0.86, 0.02]} />
          <meshStandardMaterial color="#1d1712" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.007]}>
          <planeGeometry args={[0.6, 0.8]} />
          <meshStandardMaterial map={tex.mirror} metalness={0.9} roughness={0.12} />
        </mesh>
      </group>
      {/* A shard on the floor */}
      <mesh position={[3.0, 0.004, -1.0]} rotation={[-Math.PI / 2, 0, 0.7]} raycast={() => null}>
        <circleGeometry args={[0.07, 3]} />
        <meshStandardMaterial color="#8a9496" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

function BathDoor({ open, onOpen, tex }: { open: boolean; onOpen: () => void; tex: ReturnType<typeof wood> }) {
  const ref = useRef<Group>(null);
  const angle = useRef(DOOR_AJAR);
  useFrame((_, dt) => {
    const target = open ? DOOR_OPEN : DOOR_AJAR;
    // Slow, heavy swing (exponential approach, ~2s).
    angle.current += (target - angle.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 1.6));
    if (ref.current) ref.current.rotation.y = -angle.current;
  });
  const push = () => {
    sfx.creak([2.3, 1.2, -1.8], 0.55);
    window.setTimeout(() => sfx.creak([2.4, 1.2, -1.7], 0.35), 700);
    onOpen();
  };
  const w = BATH_DOOR.width;
  return (
    <group ref={ref} position={[2.0, 0, BATH_DOOR.zHinge]} rotation-y={-DOOR_AJAR}>
      <Interactable label="Pousser la porte" distance={2.2} disabled={open} onInteract={push}>
        <mesh position={[0.025, 1.02, -w / 2]} castShadow receiveShadow>
          <boxGeometry args={[0.045, 2.04, w - 0.02]} />
          <meshStandardMaterial map={tex} color="#9b8f80" roughness={0.85} />
        </mesh>
        {/* Panels + knob */}
        {[0.55, 1.45].map((y) => (
          <mesh key={y} position={[-0.0, y, -w / 2]}>
            <boxGeometry args={[0.012, 0.6, w - 0.24]} />
            <meshStandardMaterial map={tex} color="#7a6f62" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[-0.03, 1.0, -w + 0.09]}>
          <sphereGeometry args={[0.03, 12, 10]} />
          <meshStandardMaterial color="#6d5a32" metalness={0.8} roughness={0.35} />
        </mesh>
      </Interactable>
    </group>
  );
}

function Tub({
  knowsWhere,
  apronOpen,
  onOpenApron,
  taken,
  onTake,
  grime,
}: BathroomProps & { grime: ReturnType<typeof noiseMap> }) {
  const apron = useRef<Group>(null);
  const fall = useRef({ t: -1, thudded: false });
  const glow = useRef<PointLight>(null);
  const fragment = useRef<Group>(null);
  const [hover, setHover] = useState(false);

  const len = TUB.z1 - TUB.z0;
  const zc = (TUB.z0 + TUB.z1) / 2;
  const x0 = TUB.x0;
  const depth = 4.48 - x0;

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const f = fall.current;
    if (apronOpen && f.t < 0) f.t = 0;
    if (f.t >= 0 && apron.current) {
      f.t += dt;
      // Pries loose (small wobble), then topples onto the tiles.
      const t = f.t;
      let a: number;
      if (t < 0.4) a = Math.sin(t * 40) * 0.02 + t * 0.15;
      else {
        const u = Math.min((t - 0.4) / 0.55, 1);
        a = 0.06 + (Math.PI / 2 - 0.08) * u * u;
        if (u >= 1 && !f.thudded) {
          f.thudded = true;
          sfx.thud([x0 - 0.3, 0.1, zc], 0.6);
        }
      }
      apron.current.rotation.z = a;
    }
    if (glow.current) glow.current.intensity = apronOpen && !taken ? 0.25 + Math.sin(clock.elapsedTime * 2) * 0.05 + (hover ? 0.2 : 0) : 0;
    if (fragment.current) fragment.current.visible = !taken;
  });

  const examine = () => {
    if (!knowsWhere) {
      ui().showToast('Une eau noire, immobile. Le tablier sonne creux.');
      sfx.thud([x0, 0.3, zc], 0.15);
      return;
    }
    sfx.creak([x0, 0.3, zc], 0.5);
    onOpenApron();
  };

  return (
    <group>
      {/* Enamel basin block (above the cavity) */}
      <mesh position={[x0 + 0.04 + depth / 2, 0.43, zc]} castShadow receiveShadow>
        <boxGeometry args={[depth - 0.04, 0.38, len]} />
        <meshStandardMaterial color="#b8b3a0" roughness={0.4} roughnessMap={grime} />
      </mesh>
      {/* Rim */}
      <RoundedBox args={[depth + 0.04, 0.05, len + 0.04]} radius={0.02} position={[x0 + depth / 2, 0.62, zc]} castShadow>
        <meshStandardMaterial color="#cdc7b3" roughness={0.3} roughnessMap={grime} />
      </RoundedBox>
      {/* Black still water */}
      <mesh position={[x0 + depth / 2, 0.646, zc]} rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[depth - 0.14, len - 0.14]} />
        <meshStandardMaterial color="#040504" roughness={0.04} metalness={0.2} />
      </mesh>
      {/* Cavity walls under the basin (end caps) */}
      {[TUB.z0 + 0.02, TUB.z1 - 0.02].map((z) => (
        <mesh key={z} position={[x0 + depth / 2, 0.12, z]}>
          <boxGeometry args={[depth, 0.24, 0.04]} />
          <meshStandardMaterial color="#2a2620" roughness={1} />
        </mesh>
      ))}
      <mesh position={[x0 + depth / 2, 0.003, zc]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, len]} />
        <meshStandardMaterial color="#1b1712" roughness={1} />
      </mesh>

      {/* Apron panel: pivots on its bottom edge and falls toward the room (-X) */}
      <group ref={apron} position={[x0, 0, zc]}>
        <Interactable
          label={knowsWhere ? 'Desceller le tablier' : 'Examiner la baignoire'}
          distance={2.3}
          disabled={apronOpen}
          onInteract={examine}
        >
          <mesh position={[-0.015, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.03, 0.6, len]} />
            <meshStandardMaterial color="#a9a491" roughness={0.45} roughnessMap={grime} />
          </mesh>
        </Interactable>
      </group>

      {/* The fragment, wrapped in the dark under the tub */}
      <group ref={fragment} position={FRAGMENT_POS}>
        <Interactable label="Prendre le fragment" distance={2.4} disabled={!apronOpen || taken} onHoverChange={setHover} onInteract={onTake}>
          <group rotation={[-Math.PI / 2, 0, 0.4]}>
            <RoundedBox args={[0.11, 0.16, 0.014]} radius={0.006} castShadow>
              <meshStandardMaterial color="#8a6a2e" metalness={0.85} roughness={0.35} emissive="#3a2408" emissiveIntensity={hover ? 1.2 : 0.4} />
            </RoundedBox>
            <mesh position={[0, 0.058, 0.008]}>
              <torusGeometry args={[0.012, 0.003, 6, 16]} />
              <meshStandardMaterial color="#1a1208" />
            </mesh>
            <Text font={FONT_DISPLAY} fontSize={0.08} position={[0, -0.015, 0.0085]} color="#f3d79a" anchorX="center" anchorY="middle">
              4
            </Text>
          </group>
        </Interactable>
        <pointLight ref={glow} position={[-0.15, 0.12, 0]} color="#ffc070" intensity={0} distance={0.9} decay={2} />
      </group>
    </group>
  );
}
