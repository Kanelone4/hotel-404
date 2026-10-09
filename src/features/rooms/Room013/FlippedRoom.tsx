import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { DoubleSide, type MeshStandardMaterial, type PointLight } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { carpet, wallpaper, wood, glow } from '@/lib/textures/procedural';
import { FONT_DISPLAY, FONT_MONO } from '@/lib/loaders/fonts';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import {
  H, HALF_W, HALF_D, BED, NIGHTSTANDS, NIGHTSTAND, WARDROBE, TABLE, FLOOR_LAMP, CHANDELIER, DOOR, WINDOW,
  KEY_LOCAL, toWorld,
} from './layout';
import { breathingMaterial, plaster, nightSky, seascape } from './materials';
import { KeyModel } from './KeyModel';

export interface FlippedRoomProps {
  /** The key has been pulled out of the mirror: hide the overhead one. */
  keyReleased: boolean;
  onReachKey: () => void;
  /** 0..1 — lights dim/flare during the fall / exit. */
  lightsRef: React.MutableRefObject<number>;
}

/**
 * A perfectly ordinary hotel room, authored right-side-up, then rotated π
 * around Z so that its ceiling lands at world y = 0 (see layout.ts).
 */
export function FlippedRoom({ keyReleased, onReachKey, lightsRef }: FlippedRoomProps) {
  return (
    <group position={[0, H, 0]} rotation={[0, 0, Math.PI]}>
      <Shell />
      <Bed />
      <Nightstands />
      <Wardrobe />
      <TableAndChairs />
      <FloorLamp lightsRef={lightsRef} />
      <Chandelier lightsRef={lightsRef} />
      <WindowWall />
      <Door />
      <Painting />
      <LipstickMessage />
      {!keyReleased && <OverheadKey onReach={onReachKey} />}
    </group>
  );
}

// ── Shell: carpet floor (overhead), plaster ceiling (underfoot), breathing walls ──
function Shell() {
  const wallMat = useMemo(() => breathingMaterial(wallpaper([7, 3.4], '#3b1a23', '#5b2a35', 13)), []);
  const wallMatSide = useMemo(() => breathingMaterial(wallpaper([8, 3.4], '#3b1a23', '#5b2a35', 13)), []);
  const carpetTex = useMemo(() => carpet([7, 8], ['#1f2a24', '#3c4f43', '#b98a3a', '#5b2a35']), []);
  const plasterTex = useMemo(() => plaster(), []);
  const W = HALF_W * 2;
  const D = HALF_D * 2;
  return (
    <group>
      {/* Carpet (real floor, now the ceiling) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={carpetTex} roughness={0.95} />
      </mesh>
      {/* Plaster ceiling (now the player's floor) */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={plasterTex} roughness={0.9} />
      </mesh>
      {/* Ceiling rosette around the chandelier base */}
      <mesh position={[CHANDELIER.x, H - 0.005, CHANDELIER.z]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.55, 40]} />
        <meshStandardMaterial color="#e2d6bd" roughness={0.7} />
      </mesh>
      <mesh position={[CHANDELIER.x, H - 0.012, CHANDELIER.z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.025, 8, 40]} />
        <meshStandardMaterial color="#efe4cb" roughness={0.6} />
      </mesh>
      {/* Smoke detector, blinking (on the player's floor) */}
      <SmokeDetector />

      {/* Walls — subdivided for the breathing vertex shader */}
      <mesh position={[0, H / 2, -HALF_D]} material={wallMat}>
        <planeGeometry args={[W, H, 40, 20]} />
      </mesh>
      <mesh position={[0, H / 2, HALF_D]} rotation={[0, Math.PI, 0]} material={wallMat}>
        <planeGeometry args={[W, H, 40, 20]} />
      </mesh>
      <mesh position={[-HALF_W, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={wallMatSide}>
        <planeGeometry args={[D, H, 44, 20]} />
      </mesh>
      <mesh position={[HALF_W, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMatSide}>
        <planeGeometry args={[D, H, 44, 20]} />
      </mesh>

      {/* Baseboards (overhead) and crown moulding (at the player's feet) */}
      {[
        { y: 0.06, h: 0.12, d: 0.03, c: '#2a1810' },
        { y: H - 0.07, h: 0.14, d: 0.07, c: '#d8ccb2' },
      ].map((b, i) => (
        <group key={i}>
          <mesh position={[0, b.y, -HALF_D + b.d / 2]}>
            <boxGeometry args={[W, b.h, b.d]} />
            <meshStandardMaterial color={b.c} roughness={0.6} />
          </mesh>
          <mesh position={[0, b.y, HALF_D - b.d / 2]}>
            <boxGeometry args={[W, b.h, b.d]} />
            <meshStandardMaterial color={b.c} roughness={0.6} />
          </mesh>
          <mesh position={[-HALF_W + b.d / 2, b.y, 0]}>
            <boxGeometry args={[b.d, b.h, D]} />
            <meshStandardMaterial color={b.c} roughness={0.6} />
          </mesh>
          <mesh position={[HALF_W - b.d / 2, b.y, 0]}>
            <boxGeometry args={[b.d, b.h, D]} />
            <meshStandardMaterial color={b.c} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SmokeDetector() {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = clock.elapsedTime % 3 < 0.12 ? 6 : 0.2;
  });
  return (
    <group position={[1.6, H, 2.2]}>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.04, 20]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.5} />
      </mesh>
      <mesh position={[0.03, -0.042, 0]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshStandardMaterial ref={mat} color="#300" emissive="#ff2a1a" emissiveIntensity={0.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Bed ─────────────────────────────────────────────────────────────────────
function Bed() {
  const woodTex = useMemo(() => wood([1, 1], '#4a2a18', 3), []);
  const { x, z, w, l, frame, top } = BED;
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.06), 0.06, sz * (l / 2 - 0.06)]}>
            <cylinderGeometry args={[0.035, 0.03, 0.12, 10]} />
            <meshStandardMaterial map={woodTex} roughness={0.5} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.12 + (frame - 0.12) / 2, 0]}>
        <boxGeometry args={[w, frame - 0.12, l]} />
        <meshStandardMaterial map={woodTex} roughness={0.55} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, frame + (top - frame) / 2 - 0.02, 0.02]}>
        <boxGeometry args={[w - 0.06, top - frame, l - 0.08]} />
        <meshStandardMaterial color="#efe8da" roughness={0.9} />
      </mesh>
      {/* Duvet, folded back at the head */}
      <mesh position={[0, top + 0.02, 0.25]}>
        <boxGeometry args={[w + 0.04, 0.07, l - 0.55]} />
        <meshStandardMaterial color="#6b1e2c" roughness={0.85} />
      </mesh>
      <mesh position={[0, top + 0.07, -0.3]}>
        <boxGeometry args={[w + 0.02, 0.06, 0.28]} />
        <meshStandardMaterial color="#efe8da" roughness={0.9} />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.65, -l / 2 + 0.04]}>
        <boxGeometry args={[w + 0.12, 1.3, 0.08]} />
        <meshStandardMaterial map={woodTex} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, -l / 2 + 0.09]}>
        <boxGeometry args={[w - 0.1, 0.6, 0.04]} />
        <meshStandardMaterial color="#3d1820" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Nightstands() {
  const woodTex = useMemo(() => wood([1, 1], '#5a3820', 8), []);
  const { w, h, d } = NIGHTSTAND;
  return (
    <>
      {NIGHTSTANDS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial map={woodTex} roughness={0.55} />
          </mesh>
          <mesh position={[0, h * 0.7, d / 2 + 0.005]}>
            <boxGeometry args={[w - 0.06, 0.005, 0.005]} />
            <meshStandardMaterial color="#1a0e08" />
          </mesh>
          <mesh position={[0, h * 0.82, d / 2 + 0.015]}>
            <sphereGeometry args={[0.015, 10, 8]} />
            <meshStandardMaterial color="#c9973f" metalness={0.8} roughness={0.3} />
          </mesh>
          {i === 0 ? <TableLamp y={h} /> : <Phone y={h} />}
        </group>
      ))}
    </>
  );
}

function TableLamp({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.08, 0.24, 16]} />
        <meshStandardMaterial color="#20302a" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.1, 0.17, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#f3dfb5" emissive="#ffb766" emissiveIntensity={1.6} side={DoubleSide} />
      </mesh>
      <pointLight position={[0, 0.3, 0.05]} intensity={2.2} distance={4} decay={1.8} color="#ffbf73" />
    </group>
  );
}

function Phone({ y }: { y: number }) {
  return (
    <Interactable
      label="Décrocher le téléphone"
      position={[0, y, 0.02]}
      onInteract={() => {
        sfx.buzz(toWorld(1.25, 0.6, -3.7), 0.2);
        ui().showToast('Une voix, très loin : « ? zednetne’m suoV .noitpecéR »');
      }}
    >
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.16]} />
        <meshStandardMaterial color="#5e1420" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.025, 0.16, 4, 10]} />
        <meshStandardMaterial color="#5e1420" roughness={0.35} />
      </mesh>
    </Interactable>
  );
}

function Wardrobe() {
  const woodTex = useMemo(() => wood([1, 2], '#3e2416', 11), []);
  const { x, z, w, h, d } = WARDROBE;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={woodTex} roughness={0.55} />
      </mesh>
      <mesh position={[w / 2 + 0.003, h / 2 + 0.05, 0]}>
        <boxGeometry args={[0.006, h - 0.25, 0.006]} />
        <meshStandardMaterial color="#120a05" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[w / 2 + 0.02, h * 0.52, s * 0.06]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <meshStandardMaterial color="#c9973f" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Cornice */}
      <mesh position={[0, h + 0.03, 0]}>
        <boxGeometry args={[w + 0.06, 0.06, d + 0.06]} />
        <meshStandardMaterial map={woodTex} roughness={0.5} />
      </mesh>
    </group>
  );
}

function TableAndChairs() {
  const woodTex = useMemo(() => wood([1, 1], '#6a4428', 21), []);
  const { x, z, w, d, h } = TABLE;
  const legs: [number, number][] = [
    [-w / 2 + 0.05, -d / 2 + 0.05],
    [w / 2 - 0.05, -d / 2 + 0.05],
    [-w / 2 + 0.05, d / 2 - 0.05],
    [w / 2 - 0.05, d / 2 - 0.05],
  ];
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h - 0.02, 0]}>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial map={woodTex} roughness={0.45} />
      </mesh>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, (h - 0.04) / 2, lz]}>
          <boxGeometry args={[0.045, h - 0.04, 0.045]} />
          <meshStandardMaterial map={woodTex} roughness={0.5} />
        </mesh>
      ))}
      {/* Fruit bowl stays glued (the fruits did not) */}
      <mesh position={[0.15, h + 0.04, 0.05]}>
        <sphereGeometry args={[0.14, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#d9d2c0" roughness={0.3} side={DoubleSide} />
      </mesh>
      <Chair position={[-0.1, 0, -d / 2 - 0.35]} rotY={0} tex={woodTex} />
      <Chair position={[-w / 2 - 0.3, 0, 0.1]} rotY={Math.PI / 2 + 0.3} tex={woodTex} />
    </group>
  );
}

function Chair({ position, rotY, tex }: { position: [number, number, number]; rotY: number; tex: ReturnType<typeof wood> }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.44, 0.05, 0.42]} />
        <meshStandardMaterial color="#5b2a35" roughness={0.9} />
      </mesh>
      {[
        [-0.19, -0.18],
        [0.19, -0.18],
        [-0.19, 0.18],
        [0.19, 0.18],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.215, lz]}>
          <boxGeometry args={[0.04, 0.43, 0.04]} />
          <meshStandardMaterial map={tex} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -0.2]}>
        <boxGeometry args={[0.42, 0.5, 0.04]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
    </group>
  );
}

function FloorLamp({ lightsRef }: { lightsRef: React.MutableRefObject<number> }) {
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Unstable bulb: a slow flicker that worsens when the room shakes.
    const flick = Math.sin(t * 17) * Math.sin(t * 3.1) > 0.85 ? 0.3 : 1;
    if (light.current) light.current.intensity = 1.6 * flick * lightsRef.current;
  });
  const { x, z, h } = FLOOR_LAMP;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 20]} />
        <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, h, 8]} />
        <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, h - 0.05, 0]}>
        <cylinderGeometry args={[0.13, 0.22, 0.3, 24, 1, true]} />
        <meshStandardMaterial color="#efe0c0" emissive="#ffc27a" emissiveIntensity={1.3} side={DoubleSide} />
      </mesh>
      <pointLight ref={light} position={[0, h - 0.15, 0]} intensity={1.6} distance={5} decay={1.8} color="#ffc98a" />
    </group>
  );
}

// ── Chandelier: hangs from the ceiling — so it now grows out of the player's floor ──
function Chandelier({ lightsRef }: { lightsRef: React.MutableRefObject<number> }) {
  const light = useRef<PointLight>(null);
  const bulbMat = useRef<MeshStandardMaterial>(null);
  const crystals = useRef<(import('three').Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = lightsRef.current;
    if (light.current) light.current.intensity = 7 * k;
    if (bulbMat.current) bulbMat.current.emissiveIntensity = 3 * k;
    // Crystals hang "down" (= up for the player) and sway as if gravity hesitated.
    crystals.current.forEach((m, i) => {
      if (m) m.rotation.z = Math.sin(t * 1.3 + i) * 0.12;
    });
  });
  const { x, z, drop } = CHANDELIER;
  const arms = 6;
  const bodyY = H - drop + 0.35;
  return (
    <group position={[x, 0, z]}>
      {/* Chain */}
      <mesh position={[0, H - (drop - 0.35) / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, drop - 0.35, 6]} />
        <meshStandardMaterial color="#8a6a2a" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Body */}
      <mesh position={[0, bodyY, 0]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial color="#b08a3a" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, bodyY - 0.2, 0]}>
        <coneGeometry args={[0.06, 0.25, 12]} />
        <meshStandardMaterial color="#b08a3a" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, bodyY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.012, 8, 48]} />
        <meshStandardMaterial color="#b08a3a" metalness={0.9} roughness={0.25} />
      </mesh>
      {Array.from({ length: arms }, (_, i) => {
        const a = (i / arms) * Math.PI * 2;
        const cx = Math.cos(a) * 0.38;
        const cz = Math.sin(a) * 0.38;
        return (
          <group key={i} position={[cx, bodyY, cz]}>
            {/* Candle sleeve + bulb, pointing local up (= down for the player) */}
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.018, 0.022, 0.14, 10]} />
              <meshStandardMaterial color="#f3ead6" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.17, 0]} scale={[1, 1.6, 1]}>
              <sphereGeometry args={[0.03, 12, 10]} />
              <meshStandardMaterial ref={i === 0 ? bulbMat : undefined} color="#fff4dc" emissive="#ffcf8a" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            {/* Crystal drop */}
            <mesh ref={(m) => (crystals.current[i] = m)} position={[0, -0.12, 0]}>
              <octahedronGeometry args={[0.04, 0]} />
              <meshStandardMaterial color="#e8f2ff" metalness={0.1} roughness={0.05} transparent opacity={0.75} emissive="#9fc4ff" emissiveIntensity={0.25} />
            </mesh>
          </group>
        );
      })}
      <Interactable
        label="Toucher le lustre"
        position={[0, bodyY - 0.38, 0]}
        onInteract={() => {
          sfx.ding(toWorld(x, bodyY, z), 0.12);
          ui().showToast('Le cristal tinte. Le lustre pousse du sol comme une plante qui aurait peur du ciel.');
        }}
      >
        <mesh>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#e8f2ff" roughness={0.05} transparent opacity={0.8} emissive="#9fc4ff" emissiveIntensity={0.4} />
        </mesh>
      </Interactable>
      <pointLight ref={light} position={[0, bodyY + 0.1, 0]} intensity={7} distance={10} decay={1.6} color="#ffcf8a" />
    </group>
  );
}

function WindowWall() {
  const sky = useMemo(() => nightSky(), []);
  const { z, y, w, h } = WINDOW;
  const x = HALF_W - 0.02;
  return (
    <group position={[x, y, z]} rotation={[0, -Math.PI / 2, 0]}>
      <Interactable
        label="Regarder dehors"
        onInteract={() => ui().showToast('Les étoiles sont sous la fenêtre. On pourrait tomber dedans.')}
      >
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={sky} toneMapped={false} />
        </mesh>
      </Interactable>
      {/* Frame + cross bars */}
      {[
        [0, h / 2, w + 0.1, 0.06],
        [0, -h / 2, w + 0.1, 0.06],
        [0, 0, w, 0.03],
      ].map(([fx, fy, fw, fh], i) => (
        <mesh key={`h${i}`} position={[fx, fy, 0.03]}>
          <boxGeometry args={[fw, fh, 0.05]} />
          <meshStandardMaterial color="#e0d6c2" roughness={0.6} />
        </mesh>
      ))}
      {[-w / 2, 0, w / 2].map((fx, i) => (
        <mesh key={`v${i}`} position={[fx, 0, 0.03]}>
          <boxGeometry args={[i === 1 ? 0.03 : 0.06, h, 0.05]} />
          <meshStandardMaterial color="#e0d6c2" roughness={0.6} />
        </mesh>
      ))}
      {/* Curtains */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.25), 0.05, 0.08]}>
          <boxGeometry args={[0.38, h + 0.6, 0.06]} />
          <meshStandardMaterial color="#6b1e2c" roughness={0.95} />
        </mesh>
      ))}
      {/* Moonlight entering (cold) */}
      <pointLight position={[0, 0, 0.6]} intensity={1.2} distance={4.5} decay={1.6} color="#8fb0ff" />
    </group>
  );
}

function Door() {
  const woodTex = useMemo(() => wood([1, 2], '#4a2c1a', 17), []);
  const { x, w, h } = DOOR;
  const z = HALF_D - 0.03;
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, 0.05]} />
        <meshStandardMaterial map={woodTex} roughness={0.55} />
      </mesh>
      <mesh position={[0, h / 2, -0.01]}>
        <boxGeometry args={[w + 0.14, h + 0.08, 0.04]} />
        <meshStandardMaterial color="#d8ccb2" roughness={0.6} />
      </mesh>
      {/* Room number, upside down for the player */}
      <Text font={FONT_DISPLAY} fontSize={0.12} position={[0, h - 0.25, 0.03]} color="#c9973f" anchorX="center" anchorY="middle">
        013
      </Text>
      {/* Handle */}
      <mesh position={[w / 2 - 0.12, 1.0, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <meshStandardMaterial color="#c9973f" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* "Ne pas déranger" sign hanging from the handle — hanging *up*, for the player */}
      <Interactable
        label="Lire l’affichette"
        position={[w / 2 - 0.08, 0.84, 0.06]}
        onInteract={() => ui().showToast('« NE PAS DÉRANGER ». Trop tard : tout a été dérangé.')}
      >
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.03, 0.004, 6, 16]} />
          <meshStandardMaterial color="#e6d2a0" />
        </mesh>
        <mesh>
          <planeGeometry args={[0.16, 0.24]} />
          <meshStandardMaterial color="#e6d2a0" roughness={0.8} side={DoubleSide} />
        </mesh>
        <Text font={FONT_MONO} fontSize={0.022} maxWidth={0.14} textAlign="center" position={[0, -0.02, 0.002]} color="#6b1e2c" anchorX="center" anchorY="middle" lineHeight={1.2}>
          {'NE PAS\nDÉRANGER\n\nPLEASE DO\nNOT DISTURB'}
        </Text>
      </Interactable>
    </group>
  );
}

function Painting() {
  const tex = useMemo(() => seascape(), []);
  return (
    <Interactable
      label="Regarder le tableau"
      position={[0, 1.9, -HALF_D + 0.03]}
      onInteract={() =>
        ui().showToast('Une marine. Le ciel est en bas. La mer, elle, s’accroche au cadre.')
      }
    >
      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[1.12, 0.74, 0.04]} />
        <meshStandardMaterial color="#8a6a2a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[1.0, 0.62]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
    </Interactable>
  );
}

/**
 * Lipstick on the carpet next to the key, written MIRRORED (scale x −1):
 * from below you read it backwards; in the floor mirror it reads right.
 */
function LipstickMessage() {
  return (
    <group position={[2.25, 0.012, -2.15]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} scale={[-1, 1, 1]}>
      <Text
        font={FONT_DISPLAY}
        fontSize={0.17}
        maxWidth={1.6}
        lineHeight={1.05}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.02}
      >
        {'PRENEZ-LA\nDANS LE MIROIR'}
        <meshStandardMaterial color="#b0102a" emissive="#ff2040" emissiveIntensity={0.6} roughness={0.4} side={DoubleSide} />
      </Text>
    </group>
  );
}

/** The key, stuck to the carpet overhead. Visible, glowing, out of reach. */
function OverheadKey({ onReach }: { onReach: () => void }) {
  const glowTex = useMemo(() => glow('#ffb35a'), []);
  const [kx, ky, kz] = KEY_LOCAL;
  return (
    <group position={[kx, ky, kz]} rotation={[0, 0.6, 0]}>
      <Interactable label="Attraper la clé n°3" distance={8} onInteract={onReach}>
        <KeyModel />
        {/* Generous invisible hit volume */}
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <sprite position={[0, 0.06, 0]} scale={[0.6, 0.6, 0.6]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} opacity={0.55} toneMapped={false} />
      </sprite>
    </group>
  );
}
