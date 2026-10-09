import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, MeshStandardMaterial, type BufferGeometry, type Group } from 'three';
import { noiseMap } from '@/lib/textures/procedural';
import { WALLS, H, BEDROOM, CORRIDOR, BATH } from './layout';
import { tiledPlane, curledStrip } from './geometry';
import {
  tornWallpaper,
  PAPER_TILE_W,
  floorboards,
  ceiling,
  corridorCarpet,
  bathTiles,
  bathFloor,
  moldDecal,
  paperStrip,
} from './textures';

const TILE_TOP = 1.5;

/** Hanging wallpaper strips: [x, yTop, z, ry, w, h, curl, seed]. */
const STRIPS: [number, number, number, number, number, number, number, number][] = [
  [-3.0, 2.55, -2.995, 0, 0.42, 1.3, 0.22, 3],
  [0.9, 2.5, -2.995, 0, 0.36, 0.9, 0.3, 4],
  [-3.495, 2.6, 0.9, Math.PI / 2, 0.45, 1.5, 0.35, 5],
  [-3.495, 2.45, -2.2, Math.PI / 2, 0.3, 0.8, 0.18, 6],
  [1.995, 2.6, 1.2, -Math.PI / 2, 0.4, 1.1, 0.25, 7],
  [-0.595, 2.5, 3.2, Math.PI / 2, 0.35, 1.25, 0.3, 8],
  [0.595, 2.55, 4.1, -Math.PI / 2, 0.38, 0.95, 0.2, 9],
  [-1.6, 2.6, 1.995, Math.PI, 0.44, 1.4, 0.28, 10],
];

/** Mold decals: [x, y, z, rx, ry, scale, seed]. */
const MOLD: [number, number, number, number, number, number, number][] = [
  [-3.2, H - 0.01, -2.7, Math.PI / 2, 0, 1.4, 1],
  [1.6, H - 0.01, 1.6, Math.PI / 2, 0, 1.0, 2],
  [4.2, H - 0.01, -2.7, Math.PI / 2, 0, 1.2, 3],
  [-3.49, 0.35, 1.7, 0, Math.PI / 2, 0.9, 4],
  [4.49, 0.5, -0.8, 0, -Math.PI / 2, 1.0, 5],
  [3.4, 1.9, -2.99, 0, 0, 0.8, 6],
];

/** Shell of the suite: walls, floors, ceilings, boarded window, hanging strips. */
export function Architecture({ reducedMotion }: { reducedMotion: boolean }) {
  const mats = useMemo(() => {
    const rough = noiseMap([3, 3], 24, 237);
    const m = {
      paper: new MeshStandardMaterial({ map: tornWallpaper(), roughness: 0.95, bumpMap: rough, bumpScale: 1.2, shadowSide: DoubleSide }),
      tile: new MeshStandardMaterial({ map: bathTiles(), roughness: 0.35, metalness: 0.05, shadowSide: DoubleSide }),
      upper: new MeshStandardMaterial({ map: ceiling(), color: '#8a8676', roughness: 1, shadowSide: DoubleSide }),
      floor: new MeshStandardMaterial({ map: floorboards(), roughness: 0.85, bumpMap: rough, bumpScale: 0.6 }),
      carpet: new MeshStandardMaterial({ map: corridorCarpet(), roughness: 1 }),
      bathFloor: new MeshStandardMaterial({ map: bathFloor(), roughness: 0.4 }),
      ceiling: new MeshStandardMaterial({ map: ceiling(), roughness: 1 }),
    };
    return m;
  }, []);

  // Wall geometries (UVs scaled by length so the sheet never stretches).
  const walls = useMemo(() => {
    const out: { geo: BufferGeometry; mat: MeshStandardMaterial; pos: [number, number, number]; ry: number }[] = [];
    for (const w of WALLS) {
      const [y0, y1] = w.y ?? [0, H];
      if (w.kind === 'paper') {
        out.push({ geo: tiledPlane(w.len, y1 - y0, PAPER_TILE_W, H, y0), mat: mats.paper, pos: [w.c[0], (y0 + y1) / 2, w.c[1]], ry: w.ry });
      } else {
        if (y0 < TILE_TOP) {
          out.push({ geo: tiledPlane(w.len, TILE_TOP - y0, 1, 1, y0), mat: mats.tile, pos: [w.c[0], (y0 + TILE_TOP) / 2, w.c[1]], ry: w.ry });
        }
        const u0 = Math.max(y0, TILE_TOP);
        out.push({ geo: tiledPlane(w.len, y1 - u0, 2, 2, u0), mat: mats.upper, pos: [w.c[0], (u0 + y1) / 2, w.c[1]], ry: w.ry });
      }
    }
    return out;
  }, [mats]);

  const floors = useMemo(() => {
    const rect = (r: { min: readonly [number, number]; max: readonly [number, number] }, tile: number) => {
      const w = r.max[0] - r.min[0];
      const d = r.max[1] - r.min[1];
      return { geo: tiledPlane(w, d, tile, tile), c: [(r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2] as const };
    };
    return {
      bed: rect(BEDROOM, 2),
      corr: rect(CORRIDOR, 1.2),
      bath: rect(BATH, 1),
      bedC: rect(BEDROOM, 2.5),
      corrC: rect(CORRIDOR, 2.5),
      bathC: rect(BATH, 2.5),
    };
  }, []);

  const strips = useMemo(() => STRIPS.map((s) => ({ s, geo: curledStrip(s[4], s[5], s[6]) })), []);

  useEffect(
    () => () => {
      walls.forEach((w) => w.geo.dispose());
      Object.values(floors).forEach((f) => f.geo.dispose());
      strips.forEach((s) => s.geo.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [walls, floors, strips, mats],
  );

  return (
    <group>
      {walls.map((w, i) => (
        <mesh key={i} geometry={w.geo} material={w.mat} position={w.pos} rotation-y={w.ry} receiveShadow castShadow />
      ))}

      {/* Floors */}
      <mesh geometry={floors.bed.geo} material={mats.floor} rotation-x={-Math.PI / 2} position={[floors.bed.c[0], 0, floors.bed.c[1]]} receiveShadow />
      <mesh geometry={floors.corr.geo} material={mats.carpet} rotation-x={-Math.PI / 2} position={[floors.corr.c[0], 0, floors.corr.c[1]]} receiveShadow />
      <mesh geometry={floors.bath.geo} material={mats.bathFloor} rotation-x={-Math.PI / 2} position={[floors.bath.c[0], 0, floors.bath.c[1]]} receiveShadow />
      {/* Ceilings */}
      {[floors.bedC, floors.corrC, floors.bathC].map((f, i) => (
        <mesh key={i} geometry={f.geo} material={mats.ceiling} rotation-x={Math.PI / 2} position={[f.c[0], H, f.c[1]]} receiveShadow />
      ))}

      <Baseboards />
      <BoardedWindow />
      <Outside />

      {strips.map(({ s, geo }, i) => (
        <HangingStrip key={i} geo={geo} pos={[s[0], s[1], s[2]]} ry={s[3]} seed={s[7]} sway={!reducedMotion} />
      ))}

      {MOLD.map(([x, y, z, rx, ry, sc, seed], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, ry, 0]} scale={sc} raycast={() => null}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial map={moldDecal(seed)} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  );
}

function HangingStrip({ geo, pos, ry, seed, sway }: { geo: BufferGeometry; pos: [number, number, number]; ry: number; seed: number; sway: boolean }) {
  const ref = useRef<Group>(null);
  const tex = useMemo(() => paperStrip(seed), [seed]);
  useFrame(({ clock }) => {
    if (!sway || !ref.current) return;
    const t = clock.elapsedTime;
    // Draft from the boarded window: tiny irregular lift of the free end.
    ref.current.rotation.x = -(Math.sin(t * 0.7 + seed) * 0.5 + Math.sin(t * 1.9 + seed * 3) * 0.5) * 0.03 - 0.02;
  });
  return (
    <group position={pos} rotation-y={ry}>
      <group ref={ref}>
        <mesh geometry={geo} castShadow raycast={() => null}>
          <meshStandardMaterial map={tex} alphaTest={0.5} side={DoubleSide} roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

function Baseboards() {
  const runs: [number, number, number, number][] = [
    // [cx, cz, len, ry]
    [-0.75, -2.99, 5.5, 0],
    [-3.49, -0.5, 5, Math.PI / 2],
    [-2.05, 1.99, 2.9, Math.PI],
    [1.3, 1.99, 1.4, Math.PI],
    [1.99, 0.3, 3.4, -Math.PI / 2],
    [1.99, -2.65, 0.7, -Math.PI / 2],
    [-0.59, 3.5, 3, Math.PI / 2],
    [0.59, 3.5, 3, -Math.PI / 2],
  ];
  return (
    <group>
      {runs.map(([x, z, len, ry], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation-y={ry} receiveShadow>
          <boxGeometry args={[len, 0.14, 0.025]} />
          <meshStandardMaterial color="#20160e" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Window on the west wall, nailed shut: cold moonlight leaks between the boards. */
function BoardedWindow() {
  const z = -0.3;
  const boards: [number, number, number][] = [
    [1.25, 0.08, 1.3],
    [1.5, -0.05, 1.25],
    [1.78, 0.12, 1.35],
    [2.0, -0.02, 1.2],
  ];
  return (
    <group position={[-3.5, 0, z]}>
      {/* Recess with faint night glow (kept under the bloom threshold). */}
      <mesh position={[0.005, 1.6, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshStandardMaterial color="#05070a" emissive="#3f5878" emissiveIntensity={0.55} />
      </mesh>
      {/* Frame */}
      {[
        [1.6, 0.58, 0.06, 1.24],
        [1.6, -0.58, 0.06, 1.24],
      ].map(([y, zz, w, h], i) => (
        <mesh key={i} position={[0.03, y, zz]}>
          <boxGeometry args={[0.06, h, w]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.9} />
        </mesh>
      ))}
      {boards.map(([y, rot, len], i) => (
        <mesh key={i} position={[0.06, y, 0]} rotation-x={rot} castShadow>
          <boxGeometry args={[0.03, 0.17, len]} />
          <meshStandardMaterial color={i % 2 ? '#3b2a1b' : '#4a3522'} roughness={0.95} />
        </mesh>
      ))}
      <pointLight position={[0.35, 1.6, 0]} color="#6c88b8" intensity={0.5} distance={3.2} decay={2} />
    </group>
  );
}

/** What lies beyond the entry door: a dim warm corridor (the world you came from). */
function Outside() {
  return (
    <group position={[0, 0, 5]}>
      <mesh position={[0, 0.001, 1.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.4, 3]} />
        <meshStandardMaterial color="#2a1410" roughness={1} />
      </mesh>
      <mesh position={[0, H / 2, 3]} rotation-y={Math.PI}>
        <planeGeometry args={[2.4, H]} />
        <meshStandardMaterial color="#120c08" side={DoubleSide} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, H / 2, 1.5]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2}>
          <planeGeometry args={[3, H]} />
          <meshStandardMaterial color="#21160d" />
        </mesh>
      ))}
      <mesh position={[0, H, 1.5]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[2.4, 3]} />
        <meshStandardMaterial color="#0d0907" />
      </mesh>
    </group>
  );
}
