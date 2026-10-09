import { useMemo, useRef, useState, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { player } from '@/features/hub/playerState';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { blockFace, ballTexture } from './textures';
import { fx, isSeen, useWhenUnseen } from './state';
import { DOUDOU_CRIB, DOUDOU_HIDE, HORSE, RUG } from './layout';
import type { Vec3 } from '@/types/game';

// ─── Teddy ────────────────────────────────────────────────────────────────

const FUR = '#9a6a42';
const FUR_LIGHT = '#c9a27a';

/** Sitting teddy, ~0.24 m tall. One eye is a button, the other was resewn as an X. */
export function TeddyMesh({ glint = 0, eyeRef }: { glint?: number; eyeRef?: Ref<MeshStandardMaterial> }) {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} scale={[1, 1.1, 0.9]} castShadow>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color={FUR} roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0.055]} scale={[1, 1.1, 0.5]}>
        <sphereGeometry args={[0.04, 12, 10]} />
        <meshStandardMaterial color={FUR_LIGHT} roughness={1} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshStandardMaterial color={FUR} roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.042, 0.215, -0.005]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial color={FUR} roughness={1} />
          </mesh>
          {/* arms */}
          <mesh position={[s * 0.07, 0.085, 0.02]} rotation-z={s * 0.6} castShadow>
            <capsuleGeometry args={[0.018, 0.05, 4, 8]} />
            <meshStandardMaterial color={FUR} roughness={1} />
          </mesh>
          {/* legs */}
          <mesh position={[s * 0.04, 0.02, 0.05]} rotation-x={Math.PI / 2} castShadow>
            <capsuleGeometry args={[0.022, 0.04, 4, 8]} />
            <meshStandardMaterial color={FUR} roughness={1} />
          </mesh>
        </group>
      ))}
      {/* snout + nose */}
      <mesh position={[0, 0.16, 0.048]} scale={[1, 0.8, 0.8]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color={FUR_LIGHT} roughness={1} />
      </mesh>
      <mesh position={[0, 0.168, 0.066]}>
        <sphereGeometry args={[0.007, 8, 6]} />
        <meshStandardMaterial color="#1a1010" roughness={0.4} />
      </mesh>
      {/* button eye (catches the light) */}
      <mesh position={[-0.02, 0.185, 0.047]}>
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshStandardMaterial ref={eyeRef} color="#111" roughness={0.15} emissive="#ffcf8a" emissiveIntensity={glint} />
      </mesh>
      {/* stitched X eye */}
      {[0.7, -0.7].map((r) => (
        <mesh key={r} position={[0.021, 0.185, 0.049]} rotation-z={r}>
          <boxGeometry args={[0.018, 0.003, 0.003]} />
          <meshStandardMaterial color="#2a1010" />
        </mesh>
      ))}
      {/* faded red ribbon */}
      <mesh position={[0, 0.125, 0.01]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.038, 0.006, 6, 16]} />
        <meshStandardMaterial color="#a8343c" roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * The teddy under the bed. Only reachable crouched (C / Ctrl): standing, the
 * mattress hides it and the Interactable stays disabled.
 */
export function HiddenTeddy({ onTake }: { onTake: () => void }) {
  const [crouched, setCrouched] = useState(false);
  const eye = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const c = player.crouchAmount > 0.6;
    if (c !== crouched) setCrouched(c);
    // Subtle glint on the button eye, only worth noticing once you're low.
    if (eye.current) eye.current.emissiveIntensity = (c ? 0.6 : 0.15) * (0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.7));
  });
  return (
    <Interactable
      label="Prendre Nounours"
      distance={2.0}
      disabled={!crouched}
      onInteract={onTake}
      position={DOUDOU_HIDE}
      rotation={[0, Math.PI / 2 + 0.3, 0.15]}
    >
      <TeddyMesh glint={0.2} eyeRef={eye} />
      {/* Generous invisible hitbox */}
      <mesh visible={false} position={[0, 0.12, 0]}>
        <boxGeometry args={[0.3, 0.26, 0.3]} />
        <meshBasicMaterial />
      </mesh>
    </Interactable>
  );
}

/** After you took it: it comes back to the bed when you're not looking. */
export function ReturningTeddy() {
  const [back, setBack] = useState(false);
  useWhenUnseen(DOUDOU_CRIB, 40, () => {
    setBack(true);
    sfx.creak([DOUDOU_CRIB[0], 0.6, DOUDOU_CRIB[2]], 0.18);
  });
  if (!back) return null;
  return (
    <Interactable
      label="Nounours ?"
      distance={2.4}
      onInteract={() => ui().showToast('Vous l’aviez pris. Vous en êtes sûr. Il vous regarde de son œil cousu.')}
      position={DOUDOU_CRIB}
      rotation={[0, Math.PI / 2, 0]}
    >
      <TeddyMesh />
    </Interactable>
  );
}

// ─── Letter blocks ────────────────────────────────────────────────────────

interface BlockDef {
  letter: string;
  from: Vec3;
  rotY: number;
  /** Where it ends up when you look away (only the 4-0-4 blocks). */
  to?: Vec3;
}

const B = 0.09;
const BLOCKS: BlockDef[] = [
  { letter: 'A', from: [-0.5, B / 2, 0.35], rotY: 0.3 },
  { letter: 'B', from: [-0.38, B / 2, 0.45], rotY: -0.5 },
  { letter: 'C', from: [-0.45, B * 1.5, 0.4], rotY: 0.1 },
  { letter: '4', from: [0.75, B / 2, 0.55], rotY: 1.1, to: [-0.11, B / 2, -1.35] },
  { letter: '0', from: [-0.9, B / 2, -0.75], rotY: 2.4, to: [0, B / 2, -1.35] },
  { letter: '4', from: [0.4, B / 2, 1.3], rotY: -0.8, to: [0.11, B / 2, -1.35] },
];

function Block({ def, i }: { def: BlockDef; i: number }) {
  const ref = useRef<Group>(null);
  const tex = useMemo(() => blockFace(def.letter, i), [def.letter, i]);
  useWhenUnseen(def.to ?? def.from, 22, () => {
    if (!def.to || !ref.current) return;
    ref.current.position.set(...def.to);
    // Facing the player standing in front of the drawings (toward +Z).
    ref.current.rotation.set(0, 0, 0);
  });
  return (
    <group ref={ref} position={def.from} rotation-y={def.rotY}>
      <Interactable label={`Cube « ${def.letter} »`} distance={2} onInteract={() => ui().showToast(def.to ? 'Un cube en bois. Le bois est tiède.' : 'Un cube en bois. Les lettres sont rongées aux coins.')}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[B, B, B]} />
          <meshStandardMaterial map={tex} roughness={0.7} />
        </mesh>
      </Interactable>
    </group>
  );
}

export function Blocks() {
  return (
    <group>
      {BLOCKS.map((b, i) => (
        <Block key={i} def={b} i={i} />
      ))}
    </group>
  );
}

// ─── Wooden train on a round track ────────────────────────────────────────

const TRACK_R = 0.55;

function Car({ loco, color }: { loco?: boolean; color: string }) {
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.07, 0.04, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {loco ? (
        <>
          <mesh position={[0, 0.08, 0.02]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.08, 12]} />
            <meshStandardMaterial color="#d1505a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.115, 0.045]} castShadow>
            <cylinderGeometry args={[0.012, 0.016, 0.04, 8]} />
            <meshStandardMaterial color="#222" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.1, -0.035]} castShadow>
            <boxGeometry args={[0.07, 0.06, 0.05]} />
            <meshStandardMaterial color="#f2d27a" roughness={0.6} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0.085, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.6} />
        </mesh>
      )}
      {[-0.035, 0.035].map((z) =>
        [-0.038, 0.038].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.02, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
            <meshStandardMaterial color="#333" roughness={0.6} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Train() {
  const cars = useRef<(Group | null)[]>([]);
  const angle = useRef(0.6);
  const target = useRef(0.6);
  // Toy moved: it goes around the track a little — only when unseen.
  useWhenUnseen([RUG[0], 0.1, RUG[2]], 30, () => {
    target.current += 2.2;
  });
  useFrame((_, dt) => {
    angle.current += (target.current - angle.current) * Math.min(1, dt * 4);
    cars.current.forEach((g, k) => {
      if (!g) return;
      const a = angle.current - k * 0.27;
      g.position.set(RUG[0] + Math.cos(a) * TRACK_R, 0.012, RUG[2] + Math.sin(a) * TRACK_R);
      g.rotation.y = -a; // tangent
    });
  });
  const colors = ['#3b6fc4', '#9ed69a', '#e88b8b'];
  return (
    <group>
      {/* Wooden track: two rails */}
      {[TRACK_R - 0.03, TRACK_R + 0.03].map((r) => (
        <mesh key={r} position={[RUG[0], 0.01, RUG[2]]} rotation-x={-Math.PI / 2} receiveShadow>
          <ringGeometry args={[r - 0.008, r + 0.008, 64]} />
          <meshStandardMaterial color="#c9a27a" roughness={0.8} />
        </mesh>
      ))}
      {colors.map((c, k) => (
        <group key={k} ref={(g) => (cars.current[k] = g)}>
          <Car loco={k === 0} color={c} />
        </group>
      ))}
    </group>
  );
}

// ─── Ball ─────────────────────────────────────────────────────────────────

export function Ball() {
  const ref = useRef<Mesh>(null);
  const tex = useMemo(ballTexture, []);
  const roll = useRef({ x: 1.0, z: -0.9, tx: 1.0, tz: -0.9 });
  // Moved: it ends up by the door, where you came in.
  useWhenUnseen([1.0, 0.1, -0.9], 35, () => {
    roll.current.tx = 0.9;
    roll.current.tz = 1.9;
  });
  useFrame(({ camera }, dt) => {
    const r = roll.current;
    const m = ref.current;
    if (!m) return;
    if (isSeen(camera, [r.x, 0.1, r.z]) && (r.x !== r.tx || r.z !== r.tz)) {
      // Snap to destination if we catch it mid-move.
      r.x = r.tx;
      r.z = r.tz;
    }
    const nx = MathUtils.damp(r.x, r.tx, 3, dt);
    const nz = MathUtils.damp(r.z, r.tz, 3, dt);
    m.rotation.x += (nz - r.z) / 0.11;
    m.rotation.z -= (nx - r.x) / 0.11;
    r.x = nx;
    r.z = nz;
    m.position.set(r.x, 0.11, r.z);
  });
  return (
    <Interactable label="Le ballon" distance={2} onInteract={() => ui().showToast('Un ballon de plage. Il sent encore l’été.')}>
      <mesh ref={ref} position={[1.0, 0.11, -0.9]} castShadow>
        <sphereGeometry args={[0.11, 24, 16]} />
        <meshStandardMaterial map={tex} roughness={0.35} />
      </mesh>
    </Interactable>
  );
}

// ─── Rocking horse ────────────────────────────────────────────────────────

/** Rocks by itself after the teddy is taken — only when you are not looking. Settles when watched. */
export function RockingHorse() {
  const rock = useRef<Group>(null);
  const s = useRef({ amp: 0, phase: 0, lastSign: 1, creakCd: 0 });
  useFrame(({ camera }, dt) => {
    const st = s.current;
    const seen = isSeen(camera, [HORSE[0], 0.5, HORSE[2]]);
    const haunted = fx.uneaseOn && fx.unease > 8 && fx.dying === 0;
    const maxAmp = fx.reducedMotion ? 0.06 : 0.16;
    if (haunted && !seen) st.amp = Math.min(maxAmp, st.amp + dt * 0.08);
    else st.amp = Math.max(0, st.amp - dt * (seen ? 0.025 : 0.05));
    st.phase += dt * 2.4;
    const a = Math.sin(st.phase) * st.amp;
    const sign = Math.sign(Math.cos(st.phase));
    st.creakCd -= dt;
    if (sign !== st.lastSign && st.amp > 0.05 && st.creakCd <= 0) {
      sfx.creak([HORSE[0], 0.3, HORSE[2]], 0.12 + st.amp);
      st.creakCd = 1.6;
    }
    st.lastSign = sign;
    if (rock.current) rock.current.rotation.z = a;
  });

  const body = '#f4efe6';
  const spot = '#8a6a4a';
  return (
    <group position={HORSE} rotation-y={0.25}>
      <Interactable
        label="Le cheval à bascule"
        distance={2.2}
        onInteract={() => {
          s.current.amp = Math.max(s.current.amp, 0.1);
          sfx.creak([HORSE[0], 0.3, HORSE[2]], 0.3);
          ui().showToast(fx.uneaseOn ? 'La selle est tiède. Comme si quelqu’un venait d’en descendre.' : 'Il s’appelle Caramel. C’est écrit au feutre sous la selle.');
        }}
      >
        <group ref={rock}>
          {/* Rockers: arcs of a big circle centered above */}
          {[-0.12, 0.12].map((z) => (
            <mesh key={z} position={[0, 0.95, z]} rotation-z={-Math.PI / 2 - 0.45}>
              <torusGeometry args={[0.95, 0.015, 6, 24, 0.9]} />
              <meshStandardMaterial color="#c0392b" roughness={0.6} />
            </mesh>
          ))}
          {/* Legs */}
          {[
            [-0.22, -0.1],
            [-0.22, 0.1],
            [0.22, -0.1],
            [0.22, 0.1],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.24, z]} rotation-z={x > 0 ? -0.2 : 0.2} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.34, 8]} />
              <meshStandardMaterial color={body} roughness={0.5} />
            </mesh>
          ))}
          {/* Body */}
          <mesh position={[0, 0.44, 0]} rotation-z={Math.PI / 2} castShadow>
            <capsuleGeometry args={[0.1, 0.32, 6, 12]} />
            <meshStandardMaterial color={body} roughness={0.5} />
          </mesh>
          {[[-0.1, 0.48, 0.09], [0.08, 0.42, -0.09], [0.15, 0.5, 0.085]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshStandardMaterial color={spot} roughness={0.6} />
            </mesh>
          ))}
          {/* Neck + head */}
          <mesh position={[0.25, 0.6, 0]} rotation-z={-0.6} castShadow>
            <capsuleGeometry args={[0.06, 0.18, 6, 10]} />
            <meshStandardMaterial color={body} roughness={0.5} />
          </mesh>
          <mesh position={[0.36, 0.72, 0]} rotation-z={-1.4} castShadow>
            <capsuleGeometry args={[0.055, 0.12, 6, 10]} />
            <meshStandardMaterial color={body} roughness={0.5} />
          </mesh>
          {[-0.04, 0.04].map((z) => (
            <mesh key={z} position={[0.33, 0.8, z]} rotation-z={-0.3}>
              <coneGeometry args={[0.02, 0.06, 6]} />
              <meshStandardMaterial color={body} roughness={0.5} />
            </mesh>
          ))}
          {[-0.05, 0.05].map((z) => (
            <mesh key={z} position={[0.38, 0.75, z]}>
              <sphereGeometry args={[0.011, 8, 6]} />
              <meshStandardMaterial color="#111" roughness={0.2} />
            </mesh>
          ))}
          {/* Mane */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[0.2 + i * 0.03, 0.62 + i * 0.03, 0]} rotation-z={-0.6}>
              <boxGeometry args={[0.03, 0.07, 0.03]} />
              <meshStandardMaterial color="#6b4a2b" roughness={1} />
            </mesh>
          ))}
          {/* Saddle + handles */}
          <mesh position={[0, 0.54, 0]}>
            <boxGeometry args={[0.14, 0.03, 0.2]} />
            <meshStandardMaterial color="#c0392b" roughness={0.7} />
          </mesh>
          <mesh position={[0.28, 0.64, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
            <meshStandardMaterial color="#c9a45a" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Tail */}
          <mesh position={[-0.3, 0.42, 0]} rotation-z={0.7}>
            <coneGeometry args={[0.03, 0.18, 6]} />
            <meshStandardMaterial color="#6b4a2b" roughness={1} />
          </mesh>
        </group>
      </Interactable>
    </group>
  );
}
