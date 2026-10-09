import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { MathUtils, type Group, type MeshStandardMaterial } from 'three';
import { FONT_MONO } from '@/lib/loaders/fonts';
import { Interactable } from '@/lib/interaction/Interactable';
import { Spatial } from '@/lib/audio/Sound';
import { musicBox, withReverb } from '@/lib/audio/synth';
import { wood, noiseMap } from '@/lib/textures/procedural';
import { useGame } from '@/stores/gameStore';
import { HALL, CABIN_CENTER_Z } from './hall/layout';
import type { RoomId } from '@/types/game';

export type ButtonKind = 'room' | 'dead' | 'special';

export interface FloorButton {
  label: string;
  kind: ButtonKind;
  room?: RoomId;
}

/** Panel layout: 2 columns, top to bottom. */
export const PANEL: FloorButton[] = [
  { label: '001', kind: 'room', room: '001' },
  { label: '013', kind: 'room', room: '013' },
  { label: '042', kind: 'room', room: '042' },
  { label: '101', kind: 'room', room: '101' },
  { label: '237', kind: 'room', room: '237' },
  { label: '404', kind: 'special', room: '404' },
  { label: '000', kind: 'dead' },
  { label: '777', kind: 'dead' },
  { label: 'SS', kind: 'dead' },
  { label: '∞', kind: 'dead' },
];

interface ElevatorProps {
  /** Doors open target (animated). */
  open: boolean;
  /** Called when a floor button is pressed. */
  onPress: (b: FloorButton) => void;
  /** Camera shake amount (0..1) driven by the hall during departure. */
  departing: boolean;
}

const { back, doorHalf, cabinDepth, cabinHalf, cabinHeight } = HALL;

/**
 * Elevator: brass frame + sliding doors on the hall's back wall, and the
 * cabin behind it with the interactive floor panel on its right wall.
 */
export function Elevator({ open, onPress, departing }: ElevatorProps) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const openness = useRef(open ? 1 : 0);
  const panelling = useMemo(() => wood([2, 1], '#3b2416', 14), []);
  const brushed = useMemo(() => noiseMap([1, 8], 8, 4), []);

  useFrame((_, dt) => {
    const target = open ? 1 : 0;
    openness.current = MathUtils.damp(openness.current, target, 3.2, dt);
    const o = openness.current;
    if (left.current) left.current.position.x = -doorHalf / 2 - o * (doorHalf - 0.05);
    if (right.current) right.current.position.x = doorHalf / 2 + o * (doorHalf - 0.05);
  });

  const doorMat = (
    <meshStandardMaterial color="#8d8f88" metalness={0.9} roughness={0.32} roughnessMap={brushed} />
  );

  return (
    <group>
      {/* Brass frame */}
      <group position={[0, 0, back + 0.02]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (doorHalf + 0.1), cabinHeight / 2, 0]} castShadow>
            <boxGeometry args={[0.2, cabinHeight, 0.16]} />
            <meshStandardMaterial color="#b08a3e" metalness={0.9} roughness={0.28} />
          </mesh>
        ))}
        <mesh position={[0, cabinHeight + 0.1, 0]}>
          <boxGeometry args={[doorHalf * 2 + 0.4, 0.2, 0.16]} />
          <meshStandardMaterial color="#b08a3e" metalness={0.9} roughness={0.28} />
        </mesh>
        <FloorIndicator position={[0, cabinHeight + 0.45, 0.02]} departing={departing} />
      </group>

      {/* Doors (slide into the wall) */}
      <group position={[0, cabinHeight / 2, back - 0.05]}>
        <group ref={left}>
          <mesh castShadow>
            <boxGeometry args={[doorHalf, cabinHeight, 0.05]} />
            {doorMat}
          </mesh>
        </group>
        <group ref={right}>
          <mesh castShadow>
            <boxGeometry args={[doorHalf, cabinHeight, 0.05]} />
            {doorMat}
          </mesh>
        </group>
      </group>

      {/* Cabin */}
      <group position={[0, 0, CABIN_CENTER_Z]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} receiveShadow>
          <planeGeometry args={[cabinHalf * 2, cabinDepth]} />
          <meshStandardMaterial color="#2a1c14" roughness={0.6} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position={[0, cabinHeight, 0]}>
          <planeGeometry args={[cabinHalf * 2, cabinDepth]} />
          <meshStandardMaterial color="#141210" />
        </mesh>
        {/* Ceiling light panel */}
        <mesh rotation-x={Math.PI / 2} position={[0, cabinHeight - 0.01, 0]}>
          <planeGeometry args={[1.4, 1.6]} />
          <meshStandardMaterial color="#fff2d6" emissive="#ffdca0" emissiveIntensity={departing ? 0.6 : 1.6} />
        </mesh>
        <pointLight position={[0, cabinHeight - 0.3, 0]} intensity={departing ? 3 : 6} distance={4.5} color="#ffd9a0" />
        {/* Walls */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * cabinHalf, cabinHeight / 2, 0]} rotation-y={(-s * Math.PI) / 2}>
            <planeGeometry args={[cabinDepth, cabinHeight]} />
            <meshStandardMaterial map={panelling} roughness={0.5} />
          </mesh>
        ))}
        {/* Back wall: mirror-ish dark glass */}
        <mesh position={[0, cabinHeight / 2, -cabinDepth / 2]}>
          <planeGeometry args={[cabinHalf * 2, cabinHeight]} />
          <meshStandardMaterial color="#1a1f1d" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Handrail */}
        <mesh position={[0, 0.95, -cabinDepth / 2 + 0.06]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, cabinHalf * 2 - 0.1]} />
          <meshStandardMaterial color="#c79a45" metalness={0.95} roughness={0.25} />
        </mesh>
        <Panel onPress={onPress} />
        <Spatial
          sound={withReverb(musicBox({ notes: [0, 4, 7, 11, 9, 7, 4, 2, null, 5, 9, 12, 11, 7, null, null], root: 392, bpm: 64, gain: 0.25, detune: 0.012 }), { wet: 0.4 })}
          position={[0, cabinHeight - 0.2, 0]}
          volume={0.3}
          refDistance={0.8}
          rolloff={2}
        />
      </group>
    </group>
  );
}

function FloorIndicator({ position, departing }: { position: [number, number, number]; departing: boolean }) {
  const allFragments = useGame((s) => s.room404Unlocked);
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.7, 0.28, 0.04]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <Text font={FONT_MONO} fontSize={0.14} position={[0, 0, 0.025]} color={allFragments ? '#ff4f5e' : '#ffb347'} letterSpacing={0.15}>
        {departing ? '▲ ▲ ▲' : allFragments ? '404' : 'RDC'}
      </Text>
    </group>
  );
}

function Panel({ onPress }: { onPress: (b: FloorButton) => void }) {
  return (
    <group position={[cabinHalf - 0.02, 1.25, 0.55]} rotation-y={-Math.PI / 2}>
      <mesh>
        <boxGeometry args={[0.44, 0.95, 0.02]} />
        <meshStandardMaterial color="#b08a3e" metalness={0.9} roughness={0.3} />
      </mesh>
      <Text font={FONT_MONO} fontSize={0.03} position={[0, 0.42, 0.015]} color="#2a1a10" letterSpacing={0.15}>
        HÔTEL 404
      </Text>
      {PANEL.map((b, i) => (
        <PanelButton key={b.label} def={b} position={[(i % 2) * 0.18 - 0.09, 0.28 - Math.floor(i / 2) * 0.155, 0.012]} onPress={onPress} />
      ))}
    </group>
  );
}

function PanelButton({ def, position, onPress }: { def: FloorButton; position: [number, number, number]; onPress: (b: FloorButton) => void }) {
  const completed = useGame((s) => (def.room ? s.completedRooms.includes(def.room) : false));
  const unlocked = useGame((s) => s.room404Unlocked);
  const cap = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const press = useRef(0);
  const [hover, setHover] = useState(false);

  const color = def.kind === 'dead' ? '#2a2622' : def.kind === 'special' ? '#ff4f5e' : completed ? '#9fd4a8' : '#ffb347';

  useFrame(({ clock }, dt) => {
    press.current = Math.max(0, press.current - dt * 2.5);
    if (cap.current) cap.current.position.z = 0.012 - Math.sin(Math.min(press.current, 1) * Math.PI) * 0.008;
    if (!mat.current) return;
    let k = def.kind === 'dead' ? 0 : 1.6;
    if (def.kind === 'special') {
      // Locked: slow dying blink. Unlocked: urgent blink.
      const t = clock.elapsedTime;
      k = unlocked ? (Math.sin(t * 9) > 0 ? 3.2 : 0.3) : Math.sin(t * 1.3) > 0.7 ? 0.9 : 0.05;
    }
    mat.current.emissiveIntensity = k + (hover ? 0.8 : 0) + press.current * 2;
  });

  return (
    <Interactable
      label={def.kind === 'dead' ? `Étage ${def.label}` : def.kind === 'special' ? 'Chambre 404' : `Chambre ${def.label}${completed ? ' ✓' : ''}`}
      distance={2.2}
      onHoverChange={setHover}
      onInteract={() => {
        press.current = 1;
        onPress(def);
      }}
      position={position}
    >
      <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.055, 0.055, 0.008, 28]} />
        <meshStandardMaterial color="#6b5428" metalness={0.9} roughness={0.35} />
      </mesh>
      <group ref={cap}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.042, 0.042, 0.016, 28]} />
          <meshStandardMaterial ref={mat} color="#1a1612" emissive={color} emissiveIntensity={1} roughness={0.4} />
        </mesh>
        <Text font={FONT_MONO} fontSize={0.026} position={[0, 0, 0.0095]} color={def.kind === 'dead' ? '#5a5248' : '#1a1208'}>
          {def.label}
        </Text>
      </group>
    </Interactable>
  );
}
