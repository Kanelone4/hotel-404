import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type MeshBasicMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { ROOM, WINDOW, DOOR } from '../layout';
import { useR1 } from '../useRoom001';
import { carpetTex, ceilingTex, dndTex, wallpaperTex } from './textures';
import { wood } from '@/lib/textures/procedural';

const WALL_INK = '#8a6a3c';
const TRIM = '#3b2414';

/** A wallpapered wall panel; `rot` orients the plane so it faces into the room. */
function Wall({ w, h, pos, rot, cast = false }: { w: number; h: number; pos: [number, number, number]; rot: number; cast?: boolean }) {
  return (
    <mesh position={pos} rotation-y={rot} receiveShadow castShadow={cast}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={wallpaperTex([Math.max(1, w / 0.9), h / 0.9])} color={WALL_INK} roughness={0.92} />
    </mesh>
  );
}

/** Floor, ceiling, wallpapered walls (window opening cut out), baseboards, door. */
export function Shell() {
  const wx0 = WINDOW.x - WINDOW.w / 2;
  const wx1 = WINDOW.x + WINDOW.w / 2;
  const wy0 = WINDOW.y - WINDOW.h / 2;
  const wy1 = WINDOW.y + WINDOW.h / 2;
  const H = ROOM.h;

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={carpetTex([4, 5])} roughness={1} color="#b89a86" />
      </mesh>
      {/* Ceiling */}
      <mesh rotation-x={Math.PI / 2} position-y={H}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={ceilingTex()} roughness={1} color="#a89c88" />
      </mesh>

      {/* Left (bed) wall and right wall */}
      <Wall w={ROOM.d} h={H} pos={[ROOM.x0, H / 2, 0]} rot={Math.PI / 2} />
      <Wall w={ROOM.d} h={H} pos={[ROOM.x1, H / 2, 0]} rot={-Math.PI / 2} />
      {/* Corridor wall */}
      <Wall w={ROOM.w} h={H} pos={[0, H / 2, ROOM.z1]} rot={Math.PI} />

      {/* Window wall: 4 panels around the opening. They cast shadows so the
          moonlight only enters through the window. */}
      <Wall w={wx0 - ROOM.x0} h={H} pos={[(ROOM.x0 + wx0) / 2, H / 2, ROOM.z0]} rot={0} cast />
      <Wall w={ROOM.x1 - wx1} h={H} pos={[(wx1 + ROOM.x1) / 2, H / 2, ROOM.z0]} rot={0} cast />
      <Wall w={WINDOW.w} h={wy0} pos={[WINDOW.x, wy0 / 2, ROOM.z0]} rot={0} cast />
      <Wall w={WINDOW.w} h={H - wy1} pos={[WINDOW.x, (wy1 + H) / 2, ROOM.z0]} rot={0} cast />

      <Baseboards />
      <Ceiling />
      <Door />
    </group>
  );
}

function Baseboards() {
  const h = 0.1;
  const t = 0.02;
  const mat = <meshStandardMaterial color={TRIM} roughness={0.6} />;
  return (
    <group>
      <mesh position={[ROOM.x0 + t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, ROOM.d]} />
        {mat}
      </mesh>
      <mesh position={[ROOM.x1 - t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, ROOM.d]} />
        {mat}
      </mesh>
      <mesh position={[0, h / 2, ROOM.z0 + t / 2]}>
        <boxGeometry args={[ROOM.w, h, t]} />
        {mat}
      </mesh>
      <mesh position={[0, h / 2, ROOM.z1 - t / 2]}>
        <boxGeometry args={[ROOM.w, h, t]} />
        {mat}
      </mesh>
      {/* Cornice */}
      <mesh position={[0, ROOM.h - 0.03, ROOM.z0 + 0.02]}>
        <boxGeometry args={[ROOM.w, 0.06, 0.04]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.8} />
      </mesh>
      <mesh position={[0, ROOM.h - 0.03, ROOM.z1 - 0.02]}>
        <boxGeometry args={[ROOM.w, 0.06, 0.04]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.8} />
      </mesh>
      <mesh position={[ROOM.x0 + 0.02, ROOM.h - 0.03, 0]}>
        <boxGeometry args={[0.04, 0.06, ROOM.d]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.8} />
      </mesh>
      <mesh position={[ROOM.x1 - 0.02, ROOM.h - 0.03, 0]}>
        <boxGeometry args={[0.04, 0.06, ROOM.d]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Flush ceiling dome (switched off — the switch is "en panne") + smoke detector. */
function Ceiling() {
  return (
    <group>
      <mesh position={[0, ROOM.h - 0.04, 0]} scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.22, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#e6dcc6" roughness={0.4} side={DoubleSide} emissive="#3a3020" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.9, ROOM.h - 0.02, 1.6]}>
        <cylinderGeometry args={[0.06, 0.06, 0.035, 20]} />
        <meshStandardMaterial color="#e9e4da" roughness={0.6} />
      </mesh>
    </group>
  );
}

const DOOR_LINES = [
  'Verrouillée. De l’extérieur.',
  'La poignée ne tourne pas. Le couloir est silencieux. Trop silencieux pour un hôtel.',
  'Vous collez l’œil au judas. Le couloir. Vide. Puis : un œil, de l’autre côté.',
];

function Door() {
  const { levels } = useR1();
  const tries = useRef(0);
  const strip = useRef<MeshBasicMaterial>(null);
  const z = ROOM.z1 - 0.03;
  const hx = DOOR.x - DOOR.w / 2 + 0.09;
  const at: [number, number, number] = [hx, 1.0, z];

  // Corridor light leaking under the door; something sometimes walks past.
  useFrame(({ clock }) => {
    const m = strip.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const cycle = t % 23;
    const shadow = cycle > 20 && cycle < 21.4 ? 0.25 + 0.75 * Math.abs(Math.sin((cycle - 20) * 4.5)) : 1;
    m.opacity = 0.85 * shadow * (1 - levels.exit);
  });

  const onDoor = () => {
    sfx.click(at, 0.5);
    window.setTimeout(() => sfx.thud(at, 0.25), 120);
    ui().showToast(DOOR_LINES[Math.min(tries.current, DOOR_LINES.length - 1)]);
    tries.current++;
  };

  return (
    <group>
      <Interactable label="Ouvrir la porte" distance={2.4} onInteract={onDoor}>
        {/* Panel */}
        <mesh position={[DOOR.x, DOOR.h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[DOOR.w, DOOR.h, 0.05]} />
          <meshStandardMaterial map={wood([1, 2], '#4a2c18', 14)} roughness={0.55} />
        </mesh>
        {/* Raised panels */}
        {[0.55, 1.45].map((y) => (
          <mesh key={y} position={[DOOR.x, y, z - 0.03]}>
            <boxGeometry args={[DOOR.w - 0.25, 0.7, 0.012]} />
            <meshStandardMaterial map={wood([1, 1], '#55331c', 15)} roughness={0.5} />
          </mesh>
        ))}
        {/* Handle (lever) */}
        <mesh position={[hx, 1.0, z - 0.05]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 16]} />
          <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[hx + 0.06, 1.0, z - 0.075]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.13, 10]} />
          <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* Peephole */}
        <mesh position={[DOOR.x, 1.55, z - 0.035]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.015, 0.015, 0.02, 12]} />
          <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* Safety chain */}
        <mesh position={[DOOR.x - DOOR.w / 2 + 0.2, 1.3, z - 0.035]} rotation-z={0.5}>
          <boxGeometry args={[0.18, 0.012, 0.012]} />
          <meshStandardMaterial color="#b8a890" metalness={0.8} roughness={0.35} />
        </mesh>
      </Interactable>

      {/* Door frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[DOOR.x + s * (DOOR.w / 2 + 0.04), DOOR.h / 2, ROOM.z1 - 0.02]}>
          <boxGeometry args={[0.08, DOOR.h + 0.04, 0.04]} />
          <meshStandardMaterial color={TRIM} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[DOOR.x, DOOR.h + 0.04, ROOM.z1 - 0.02]}>
        <boxGeometry args={[DOOR.w + 0.16, 0.08, 0.04]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>

      {/* Light under the door */}
      <mesh position={[DOOR.x, 0.006, ROOM.z1 - 0.07]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[DOOR.w - 0.04, 0.08]} />
        <meshBasicMaterial ref={strip} color="#ffcf8a" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* "Ne pas déranger" — hanging on the INSIDE handle. */}
      <Interactable
        label="« Ne pas déranger »"
        distance={2.2}
        onInteract={() => {
          sfx.click(at, 0.15);
          ui().showToast('Le carton pend du côté intérieur. Qui ne doit pas être dérangé, au juste ?');
        }}
        position={[hx + 0.02, 0.86, z - 0.07]}
        rotation={[0, Math.PI, 0.06]}
      >
        <mesh>
          <planeGeometry args={[0.11, 0.22]} />
          <meshStandardMaterial map={dndTex()} roughness={0.7} side={DoubleSide} />
        </mesh>
      </Interactable>
    </group>
  );
}
