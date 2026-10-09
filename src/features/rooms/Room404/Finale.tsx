import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import {
  BackSide,
  Fog,
  Group,
  Object3D,
  Vector3,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { RoomUI } from '@/features/rooms/RoomUI';
import { player } from '@/features/hub/playerState';
import { sfx } from '@/lib/audio/sfx';
import { travel } from '@/lib/motion/travel';
import { ui } from '@/stores/uiStore';
import { R, useNarr } from './state';
import { DOOR } from './Scenery';

/**
 * Finale cutscene (~13 s), started when useNarr.finale flips to true:
 *
 *  0.0  camera taken from the player, turns to the open door (white light)
 *  1.4  everything blows apart (uExplode), camera looks down at the floor
 *  3.0  the floor is gone: fall through the void, the other rooms float past
 *  7.0  deceleration; the camera pulls back: the whole hotel, tiny, in the void
 *  7.6  each room flies back into its window — there is no window for 404
 * 10.8  the 404 slot flickers red and dies
 * 12.2  travel('/credits', glitch)
 */
const HOTEL_Y = -60;
const COLS = 4;
const FLOORS = 7;
const WIN_W = 0.62;
const WIN_H = 0.5;
const COL_X = (c: number) => (c - (COLS - 1) / 2) * 0.95;
const FLOOR_Y = (f: number) => HOTEL_Y - 4 + 0.6 + f * 1.2;
const FACADE_Z = 1.5;

interface MiniDef {
  key: string;
  wall: string;
  inner: string;
  slot: [number, number]; // col, floor
}
const MINIS: MiniDef[] = [
  { key: '001', wall: '#c9b48f', inner: '#f2ead8', slot: [0, 0] },
  { key: '013', wall: '#5b4a6a', inner: '#c58a35', slot: [1, 1] },
  { key: '042', wall: '#0e3550', inner: '#47b6ff', slot: [2, 4] },
  { key: '101', wall: '#e3a3b8', inner: '#ffe066', slot: [3, 2] },
  { key: '237', wall: '#2c3a2a', inner: '#ff4f5e', slot: [1, 5] },
  { key: 'hall', wall: '#3a2a1a', inner: '#ffcf7a', slot: [2, 0] },
];
/** The slot that should be 404's — top floor, last column. */
const SLOT_404: [number, number] = [3, FLOORS - 1];

export function Finale({ reduced, onDoor }: { reduced: boolean; onDoor: () => void }) {
  const finale = useNarr((s) => s.finale);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const root = useRef<Group>(null);
  const minis = useRef<(Group | null)[]>([]);
  const slot404 = useRef<Mesh>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const proxy = useMemo(() => ({ x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: -1, shake: 0, slot: 0 }), []);
  const running = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!finale || running.current) return;
    running.current = true;
    const g = root.current!;
    // The void is centered under the player so the fall goes straight down.
    const ox = player.eye.x;
    const oz = player.eye.z;
    g.position.set(ox, 0, oz);

    // Take the camera.
    player.movementEnabled = false;
    player.controlsCamera = false;
    ui().setHint(null);
    const fwd = new Vector3();
    camera.getWorldDirection(fwd);
    Object.assign(proxy, {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      lx: camera.position.x + fwd.x * 3,
      ly: camera.position.y + fwd.y * 3,
      lz: camera.position.z + fwd.z * 3,
    });
    const fog = scene.fog instanceof Fog ? scene.fog : null;
    const doorP = { x: DOOR.x, y: 1.2, z: DOOR.z };

    const tl = gsap.timeline();
    // 0 — the door opens.
    tl.call(() => {
      onDoor();
      sfx.creak([DOOR.x, 1.2, DOOR.z], 0.6);
      sfx.glitch(undefined, 0.5);
    });
    tl.to(proxy, { lx: doorP.x, ly: doorP.y, lz: doorP.z, duration: 1.2, ease: 'power2.inOut' }, 0);
    tl.to(R, { finale: 0.15, duration: 1.2 }, 0);
    // 1.4 — everything comes apart.
    tl.call(
      () => {
        sfx.rumble(0.7, 3);
        sfx.glitch(undefined, 0.6);
        setCaption('Erreur 404 : chambre introuvable.');
      },
      undefined,
      1.4,
    );
    tl.to(R, { explode: 1, duration: 3.2, ease: 'power2.in' }, 1.4);
    tl.to(proxy, { shake: reduced ? 0 : 1, duration: 0.6 }, 1.4);
    tl.to(
      proxy,
      { lx: proxy.x + 0.05, ly: -2, lz: proxy.z - 1.2, duration: 1.4, ease: 'power2.inOut' },
      1.6,
    );
    if (fog) tl.to(fog, { near: 6, far: 70, duration: 5 }, 2.5);
    // 3 — the fall.
    tl.call(() => sfx.whoosh(0.7), undefined, 3);
    tl.to(proxy, { y: -40, duration: 4.2, ease: 'power2.in' }, 3);
    tl.to(proxy, { ly: -60, duration: 4.2, ease: 'power2.in' }, 3);
    tl.to(proxy, { shake: 0, duration: 2 }, 4.5);
    tl.to(R, { finale: 0.6, duration: 4 }, 3);
    tl.call(() => setCaption(null), undefined, 3.6);
    // 7 — pull back: the hotel, tiny, in the void.
    tl.to(
      proxy,
      { x: ox - 1.5, y: HOTEL_Y + 3.5, z: oz + 14, duration: 3.6, ease: 'power3.out' },
      7,
    );
    tl.to(proxy, { lx: ox, ly: HOTEL_Y + 0.5, lz: oz, duration: 3.2, ease: 'power2.inOut' }, 6.8);
    // 7.6 — every room goes back to its window.
    MINIS.forEach((m, i) => {
      const el = minis.current[i];
      if (!el) return;
      const t = 7.6 + i * 0.35;
      tl.to(
        el.position,
        {
          x: COL_X(m.slot[0]),
          y: FLOOR_Y(m.slot[1]),
          z: FACADE_Z + 0.22,
          duration: 1.6,
          ease: 'power3.inOut',
        },
        t,
      );
      tl.to(el.rotation, { x: 0, y: 0, z: 0, duration: 1.6, ease: 'power3.inOut' }, t);
      tl.call(() => sfx.click(undefined, 0.3), undefined, t + 1.5);
    });
    // 10.8 — the 404 slot: there is nothing to put in it.
    tl.to(proxy, { slot: 1, duration: 0.3 }, 10.2);
    tl.call(
      () => {
        setCaption('Chambre 404 : introuvable.');
        sfx.buzz(undefined, 0.4);
      },
      undefined,
      10.8,
    );
    tl.to(proxy, { slot: 0, duration: 0.9, ease: 'steps(6)' }, 11.2);
    tl.to(R, { finale: 1, duration: 1.5 }, 10.8);
    tl.call(
      () => {
        void travel('/credits', {
          style: 'glitch',
          text: 'Check-out effectué. La chambre 404 n’a jamais existé.',
        });
      },
      undefined,
      12.2,
    );

    tlRef.current = tl;
  }, [finale, camera, scene, proxy, reduced, onDoor]);

  // Restore the player's camera if the room unmounts mid-cutscene.
  useEffect(
    () => () => {
      tlRef.current?.kill();
      player.controlsCamera = true;
      player.movementEnabled = true;
    },
    [],
  );

  const look = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (!running.current) return;
    const s = proxy.shake * 0.05;
    camera.position.set(
      proxy.x + (Math.random() - 0.5) * s,
      proxy.y + (Math.random() - 0.5) * s,
      proxy.z + (Math.random() - 0.5) * s,
    );
    camera.lookAt(look.set(proxy.lx, proxy.ly, proxy.lz));
    // Free-floating rooms tumble slowly until they are reclaimed.
    minis.current.forEach((m, i) => {
      if (m && R.finale < 0.6) m.rotation.y += 0.004 + i * 0.001;
    });
    const s404 = slot404.current;
    if (s404) {
      const on = proxy.slot > 0.5 || (proxy.slot > 0 && Math.random() < proxy.slot);
      (s404.material as MeshBasicMaterial).color.setRGB(
        on ? 4 : 0.05,
        on ? 0.2 : 0.01,
        on ? 0.3 : 0.02,
      );
    }
  });

  return (
    <>
      <group ref={root} visible={finale}>
        <Hotel slot404={slot404} />
        {MINIS.map((m, i) => {
          const a = (i / MINIS.length) * Math.PI * 2;
          const rad = 2.4 + (i % 3) * 0.9;
          return (
            <group
              key={m.key}
              ref={(el) => {
                minis.current[i] = el;
              }}
              position={[Math.cos(a) * rad, -9 - i * 4.5, Math.sin(a) * rad]}
              rotation={[0.4 * i, a, 0.3]}
            >
              <MiniRoom def={m} />
            </group>
          );
        })}
        <pointLight position={[0, HOTEL_Y + 3, 9]} intensity={30} distance={30} color="#ffd9b0" />
      </group>
      {caption && (
        <RoomUI.In>
          <div
            className="absolute inset-x-0 top-1/3 text-center font-mono text-sm tracking-[0.4em] text-paper uppercase"
            style={{ textShadow: '2px 0 #ff4f5e, -2px 0 #4fe3ff' }}
          >
            {caption}
          </div>
        </RoomUI.In>
      )}
    </>
  );
}

/** One room as a tiny open diorama (BackSide box = always see the inside). */
function MiniRoom({ def }: { def: MiniDef }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[WIN_W - 0.06, WIN_H - 0.06, 0.4]} />
        <meshStandardMaterial
          color={def.wall}
          emissive={def.wall}
          emissiveIntensity={0.5}
          side={BackSide}
        />
      </mesh>
      <mesh position={[0, -0.12, -0.05]}>
        <boxGeometry args={[0.22, 0.08, 0.16]} />
        <meshBasicMaterial color={def.inner} toneMapped={false} />
      </mesh>
      <mesh position={[0.18, 0.1, -0.17]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color={[3, 2.5, 1.6]} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The hotel as a small model: a dark block with a grid of lit windows. */
function Hotel({ slot404 }: { slot404: RefObject<Mesh> }) {
  const windows = useRef<InstancedMesh>(null);
  const cells = useMemo(() => {
    const taken = new Set([...MINIS.map((m) => m.slot.join()), SLOT_404.join()]);
    const out: [number, number][] = [];
    for (let f = 0; f < FLOORS; f++)
      for (let c = 0; c < COLS; c++) if (!taken.has(`${c},${f}`)) out.push([c, f]);
    return out;
  }, []);
  useEffect(() => {
    const m = windows.current;
    if (!m) return;
    const d = new Object3D();
    cells.forEach(([c, f], i) => {
      d.position.set(COL_X(c), FLOOR_Y(f), FACADE_Z + 0.01);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [cells]);
  const H = FLOORS * 1.2 + 0.8;
  return (
    <group>
      <mesh position={[0, HOTEL_Y - 4 + H / 2, 0]}>
        <boxGeometry args={[COLS * 0.95 + 0.4, H, FACADE_Z * 2]} />
        <meshStandardMaterial color="#1c1714" roughness={0.9} />
      </mesh>
      {/* Roof sign. */}
      <mesh position={[0, HOTEL_Y - 4 + H + 0.25, FACADE_Z - 0.2]}>
        <boxGeometry args={[2.2, 0.35, 0.05]} />
        <meshBasicMaterial color={[2.5, 1.6, 0.6]} toneMapped={false} />
      </mesh>
      <instancedMesh ref={windows} args={[undefined, undefined, cells.length]}>
        <planeGeometry args={[WIN_W, WIN_H]} />
        <meshBasicMaterial color={[1.4, 1.0, 0.55]} toneMapped={false} />
      </instancedMesh>
      <mesh ref={slot404} position={[COL_X(SLOT_404[0]), FLOOR_Y(SLOT_404[1]), FACADE_Z + 0.012]}>
        <planeGeometry args={[WIN_W, WIN_H]} />
        <meshBasicMaterial color={[0.05, 0.01, 0.02]} toneMapped={false} />
      </mesh>
      {/* Pedestal: it's a model, after all. */}
      <mesh position={[0, HOTEL_Y - 4.1, 0]}>
        <cylinderGeometry args={[3.6, 3.8, 0.2, 32]} />
        <meshStandardMaterial color="#0d0b0a" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}
