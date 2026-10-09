import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, Text } from '@react-three/drei';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Interactable } from '@/lib/interaction/Interactable';
import { FONT_MONO } from '@/lib/loaders/fonts';
import { carpet, tiles, wallpaper, wood, rng } from '@/lib/textures/procedural';
import { corruptMaterial, explodable } from './corruptMaterial';
import {
  createTextWall,
  drawTextWall,
  drawing,
  ensureCanvasFont,
  tornWallpaper,
} from './textures404';
import { R, useNarr } from './state';
import type { Box } from '@/types/game';

export const ROOM = { w: 8, d: 8, h: 3.2 };
const HW = ROOM.w / 2;
const HD = ROOM.d / 2;

export type Act = 'door' | 'mirror' | 'key' | 'drawing' | 'water' | 'chair' | 'bed';

/** Player colliders for the furniture. */
export const COLLIDERS: Box[] = [
  { min: [2.25, 0, -2.1], max: [4, 0.9, -0.3] }, // bed
  { min: [1.05, 1.1, 0.65], max: [2.15, 2.3, 1.75] }, // floating water cube
  { min: [-2.6, 0, 1.9], max: [-1.9, 1.3, 2.6] }, // floating chair
];

/** Door to the void (north wall). */
export const DOOR = { x: 2.2, z: -HD, w: 1.0, h: 2.15 };

function chairGeometry() {
  const parts: BufferGeometry[] = [];
  for (const [x, z] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ])
    parts.push(new BoxGeometry(0.045, 0.45, 0.045).translate(x, 0.225, z));
  parts.push(new BoxGeometry(0.46, 0.05, 0.46).translate(0, 0.47, 0));
  parts.push(new BoxGeometry(0.46, 0.5, 0.045).translate(0, 0.74, -0.21));
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Everything built once; disposed on unmount. */
function useAssets() {
  const a = useMemo(() => {
    const geos: BufferGeometry[] = [];
    const mats: Material[] = [];
    const G = (g: BufferGeometry, seed?: number) => {
      const e = explodable(g, seed);
      geos.push(e);
      return e;
    };
    const M = (...args: Parameters<typeof corruptMaterial>) => {
      const m = corruptMaterial(...args);
      mats.push(m);
      return m;
    };
    const wallGeo = (w: number, h: number, sx: number, sy: number, seed: number) =>
      G(new PlaneGeometry(w, h, sx, sy), seed);

    return {
      geos,
      mats,
      floor: G(new PlaneGeometry(ROOM.w, ROOM.d, 24, 24), 1),
      tileFloor: G(new PlaneGeometry(3, 3, 8, 8), 2),
      ceiling: G(new PlaneGeometry(ROOM.w, ROOM.d, 12, 12), 3),
      wallNS: wallGeo(ROOM.w, ROOM.h, 24, 10, 4),
      wallNS2: wallGeo(ROOM.w, ROOM.h, 24, 10, 5),
      wallEW: wallGeo(ROOM.d, ROOM.h, 24, 10, 6),
      wallEW2: wallGeo(ROOM.d, ROOM.h, 24, 10, 7),
      zfight: wallGeo(3.2, ROOM.h, 8, 6, 8),
      textWall: G(new PlaneGeometry(4.2, 2.1, 16, 8), 9),
      bedBase: G(new BoxGeometry(2.2, 0.35, 1.6, 6, 2, 4).translate(0, 0.175, 0), 10),
      mattress: G(new BoxGeometry(2.0, 0.22, 1.5, 8, 2, 6).translate(0, 0.46, 0), 11),
      pillow: G(new BoxGeometry(0.45, 0.14, 0.9, 3, 2, 4).translate(0.7, 0.64, 0), 12),
      blanket: G(new BoxGeometry(1.25, 0.06, 1.56, 8, 1, 6).translate(-0.4, 0.6, 0), 13),
      headboard: G(new BoxGeometry(0.08, 1.1, 1.6, 1, 4, 6).translate(1.1, 0.55, 0), 14),
      chair: G(chairGeometry(), 15),
      waterCube: G(new BoxGeometry(1, 1, 1, 6, 6, 6), 16),
      drawingPlane: G(new PlaneGeometry(0.6, 0.6, 4, 4), 17),
      doorPanel: G(
        new BoxGeometry(DOOR.w, DOOR.h, 0.06, 4, 8, 1).translate(DOOR.w / 2, DOOR.h / 2, 0),
        18,
      ),
      doorFrame: G(
        mergeGeometries([
          new BoxGeometry(0.12, DOOR.h + 0.12, 0.16).translate(-0.06, (DOOR.h + 0.12) / 2, 0),
          new BoxGeometry(0.12, DOOR.h + 0.12, 0.16).translate(
            DOOR.w + 0.06,
            (DOOR.h + 0.12) / 2,
            0,
          ),
          new BoxGeometry(DOOR.w + 0.24, 0.12, 0.16).translate(DOOR.w / 2, DOOR.h + 0.06, 0),
        ])!,
        19,
      ),
      debris: G(new BoxGeometry(0.12, 0.12, 0.12), 20),

      mFloor: M(
        { map: carpet([3, 3], ['#2a1a12', '#6a3a1a', '#c58a35', '#3d4f46']), roughness: 0.95 },
        { bias: -0.08, drift: 0.25 },
      ),
      mTiles: M(
        { map: tiles([3, 3], '#a9c4c9', '#3b4f55', 5), roughness: 0.3, metalness: 0.1 },
        { bias: 0.05 },
      ),
      mCeil: M({ color: '#1a1416', roughness: 1 }, { bias: 0.1, drift: 0.5 }),
      mNorth: M({ map: wallpaper([4, 2], '#2f3d36', '#3e5047', 11), roughness: 0.9 }, { bias: 0 }),
      mNorthZ: M(
        { map: wallpaper([3, 2], '#5a1d22', '#7a2a30', 404), roughness: 0.9 },
        { bias: 0.15, stripes: 2 },
      ),
      mEast: M({ map: wallpaper([4, 2], '#6b5a45', '#7d6a52', 3), roughness: 0.9 }, { bias: 0.02 }),
      mSouth: M(
        { map: wallpaper([4, 2], '#3b2a3f', '#4a3650', 5), roughness: 0.9 },
        { bias: 0.04 },
      ),
      mWest: M({ map: tornWallpaper(), roughness: 0.95 }, { bias: 0.06 }),
      mBedWood: M({ map: wood([1, 1], '#4a2c18', 8), roughness: 0.7 }, { bias: 0.1 }),
      mSheet: M({ color: '#d8d2c4', roughness: 0.95 }, { bias: 0.05 }),
      mBlanket: M({ color: '#7a1f2b', roughness: 0.9 }, { bias: 0.12 }),
      mChair: M({ map: wood([1, 1], '#6b4224', 13), roughness: 0.6 }, { bias: 0.08 }),
      mWater: M(
        {
          color: '#2a7fb8',
          emissive: '#0b3f66',
          emissiveIntensity: 0.6,
          roughness: 0.05,
          metalness: 0.2,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        },
        { bias: 0.1, drift: 0.6 },
      ),
      mDrawings: [0, 1, 2].map((v) =>
        M({ map: drawing(v), roughness: 1, side: DoubleSide }, { bias: 0.05 * v }),
      ),
      mDoor: M({ map: wood([1, 2], '#2a1712', 404), roughness: 0.6 }, { bias: -0.25, drift: 0.15 }),
      mDoorFrame: M({ color: '#120c0a', roughness: 0.5 }, { bias: -0.2 }),
      mDebris: M(
        { color: '#2b2226', emissive: '#ff2244', emissiveIntensity: 0.4, roughness: 0.6 },
        { bias: 0.3, drift: 0.2 },
      ),
    };
  }, []);
  useEffect(
    () => () => {
      a.geos.forEach((g) => g.dispose());
      a.mats.forEach((m) => m.dispose());
    },
    [a],
  );
  return a;
}

export interface SceneryProps {
  onAct: (what: Act) => void;
  doorOpen: boolean;
  high: boolean;
}

export function Scenery({ onAct, doorOpen, high }: SceneryProps) {
  const a = useAssets();
  return (
    <group>
      {/* ── Shell ─────────────────────────────────────────────── */}
      <mesh geometry={a.floor} material={a.mFloor} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh
        geometry={a.tileFloor}
        material={a.mTiles}
        rotation-x={-Math.PI / 2}
        position={[-HW + 1.5, 0.004, HD - 1.5]}
      />
      <mesh geometry={a.ceiling} material={a.mCeil} rotation-x={Math.PI / 2} position-y={ROOM.h} />
      <mesh geometry={a.wallNS} material={a.mNorth} position={[0, ROOM.h / 2, -HD]} />
      {/* Coplanar duplicate → real z-fighting stripes (a corrupted copy of the wall). */}
      <mesh geometry={a.zfight} material={a.mNorthZ} position={[-2.2, ROOM.h / 2, -HD]} />
      <mesh
        geometry={a.wallNS2}
        material={a.mSouth}
        position={[0, ROOM.h / 2, HD]}
        rotation-y={Math.PI}
      />
      <mesh
        geometry={a.wallEW}
        material={a.mEast}
        position={[HW, ROOM.h / 2, 0]}
        rotation-y={-Math.PI / 2}
      />
      <mesh
        geometry={a.zfight}
        material={a.mNorthZ}
        position={[HW, ROOM.h / 2, 2]}
        rotation-y={-Math.PI / 2}
      />
      <mesh
        geometry={a.wallEW2}
        material={a.mWest}
        position={[-HW, ROOM.h / 2, 0]}
        rotation-y={Math.PI / 2}
      />

      <MonologueWall geometry={a.textWall} />

      {/* ── 001: the bed, half swallowed by the east wall ───────── */}
      <Interactable
        label="Le lit (défait)"
        onInteract={() => onAct('bed')}
        position={[3.35, 0, -1.2]}
        rotation={[0, 0.12, 0.03]}
        distance={2.6}
      >
        <mesh geometry={a.bedBase} material={a.mBedWood} />
        <mesh geometry={a.mattress} material={a.mSheet} />
        <mesh geometry={a.pillow} material={a.mSheet} />
        <mesh geometry={a.blanket} material={a.mBlanket} />
        <mesh geometry={a.headboard} material={a.mBedWood} />
      </Interactable>
      {/* A second bed, rotated into the floor: an impossible copy. */}
      <group position={[0.4, -0.25, -2.6]} rotation={[0.25, -0.6, 0.15]} scale={0.8}>
        <mesh geometry={a.mattress} material={a.mSheet} />
        <mesh geometry={a.blanket} material={a.mBlanket} />
      </group>

      {/* ── 013: chairs, one on the ceiling, one floating ────────── */}
      <mesh
        geometry={a.chair}
        material={a.mChair}
        position={[-1.4, ROOM.h, -1.2]}
        rotation={[0, 0.4, Math.PI]}
      />
      <mesh
        geometry={a.chair}
        material={a.mChair}
        position={[0.9, ROOM.h, 1.8]}
        rotation={[0, 2.1, Math.PI]}
      />
      <FloatingChair geometry={a.chair} material={a.mChair} onAct={onAct} />

      {/* ── 042: water on the floor and water standing in the air ── */}
      <WaterPool position={[-HW + 1.5, 0.02, HD - 1.5]} />
      <WaterCube geometry={a.waterCube} material={a.mWater} onAct={onAct} />

      {/* ── 101: drawings taped everywhere, even on the ceiling ──── */}
      <Interactable
        label="Regarder le dessin"
        onInteract={() => onAct('drawing')}
        position={[HW - 0.02, 1.75, -1.0]}
        rotation={[0, -Math.PI / 2, 0.08]}
      >
        <mesh geometry={a.drawingPlane} material={a.mDrawings[0]} />
      </Interactable>
      <mesh
        geometry={a.drawingPlane}
        material={a.mDrawings[1]}
        position={[1.2, 1.55, HD - 0.02]}
        rotation={[0, Math.PI, -0.1]}
      />
      <mesh
        geometry={a.drawingPlane}
        material={a.mDrawings[2]}
        position={[-0.6, ROOM.h - 0.01, 0.4]}
        rotation={[Math.PI / 2, 0, 0.6]}
      />
      <mesh
        geometry={a.drawingPlane}
        material={a.mDrawings[0]}
        position={[-HW + 0.02, 2.3, -2.4]}
        rotation={[0, Math.PI / 2, -0.2]}
        scale={0.7}
      />
      <mesh
        geometry={a.drawingPlane}
        material={a.mDrawings[2]}
        position={[HW - 0.03, 2.3, 1.2]}
        rotation={[0, -Math.PI / 2, 0.3]}
        scale={0.8}
      />

      {/* ── The door, the mirror, the key ───────────────────────── */}
      <Door
        panel={a.doorPanel}
        frame={a.doorFrame}
        mDoor={a.mDoor}
        mFrame={a.mDoorFrame}
        open={doorOpen}
        onAct={onAct}
      />
      <Mirror high={high} onAct={onAct} />
      <Key onAct={onAct} />

      <Debris geometry={a.debris} material={a.mDebris} />
      <Lights />
    </group>
  );
}

/** Wall of text mirroring the DOM monologue (scrambles + leaks included). */
function MonologueWall({ geometry }: { geometry: BufferGeometry }) {
  const wall = useMemo(() => createTextWall(), []);
  const mat = useMemo(
    () =>
      corruptMaterial(
        {
          color: '#000',
          map: wall.texture,
          emissive: '#ffffff',
          emissiveMap: wall.texture,
          emissiveIntensity: 1.1,
          roughness: 1,
        },
        { bias: -0.12, drift: 0.12 },
      ),
    [wall],
  );
  const st = useRef({ version: -1, last: 0, anim: false });
  useEffect(() => {
    ensureCanvasFont();
    return () => {
      mat.dispose();
      wall.texture.dispose();
    };
  }, [mat, wall]);
  useFrame(() => {
    const s = st.current;
    // Redraw when the DOM text changed (or a line is falling), throttled to ~15 fps.
    if ((s.version !== R.textVersion || s.anim) && R.time - s.last > 1 / 15) {
      s.version = R.textVersion;
      s.last = R.time;
      s.anim = drawTextWall(wall, R.displayed, R.leakedAt, R.time, R.corruption);
    }
  });
  return <mesh geometry={geometry} material={mat} position={[-1.3, 1.6, -HD + 0.03]} />;
}

function FloatingChair({
  geometry,
  material,
  onAct,
}: {
  geometry: BufferGeometry;
  material: Material;
  onAct: (a: Act) => void;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = R.time;
    g.position.y = 0.55 + Math.sin(t * 0.7) * 0.08;
    g.rotation.set(0.35 + Math.sin(t * 0.3) * 0.1, t * 0.15, 2.6);
  });
  return (
    <Interactable
      label="La chaise (013)"
      onInteract={() => onAct('chair')}
      position={[-2.25, 0, 2.25]}
    >
      <group ref={ref}>
        <mesh geometry={geometry} material={material} position={[0, -0.4, 0]} />
      </group>
    </Interactable>
  );
}

function WaterCube({
  geometry,
  material,
  onAct,
}: {
  geometry: BufferGeometry;
  material: Material;
  onAct: (a: Act) => void;
}) {
  const ref = useRef<Group>(null);
  const bubbles = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 18 }, () => [r() - 0.5, r(), r() - 0.5, 0.3 + r() * 0.7] as const);
  }, []);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const t = R.time;
    if (ref.current) {
      ref.current.rotation.set(Math.sin(t * 0.2) * 0.1, t * 0.1, Math.cos(t * 0.17) * 0.08);
      ref.current.position.y = 1.7 + Math.sin(t * 0.5) * 0.05;
    }
    const b = bubbles.current;
    if (b) {
      seeds.forEach(([x, y0, z, s], i) => {
        const y = ((y0 + t * 0.12 * s) % 1) - 0.5;
        dummy.position.set(x * 0.8 + Math.sin(t * 2 + i) * 0.02, y * 0.95, z * 0.8);
        dummy.scale.setScalar(0.02 + s * 0.025);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <Interactable label="Toucher l’eau" onInteract={() => onAct('water')} position={[1.6, 0, 1.2]}>
      <group ref={ref} position-y={1.7}>
        <mesh geometry={geometry} material={material} renderOrder={2} />
        <instancedMesh
          ref={bubbles}
          args={[undefined, undefined, seeds.length]}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color="#bfe6ff"
            emissive="#5fb6ff"
            emissiveIntensity={0.6}
            transparent
            opacity={0.6}
          />
        </instancedMesh>
      </group>
    </Interactable>
  );
}

/** Shallow water on the tiles: animated ripples, glitching bands. */
function WaterPool({ position }: { position: [number, number, number] }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uC: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uC;
          varying vec2 vUv;
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            vec2 uv = vUv;
            // Corruption: horizontal bands of the water slip sideways.
            float band = floor(uv.y * 14.0);
            uv.x += step(1.0 - uC * 0.5, h(vec2(band, floor(uTime * 4.0)))) * 0.2;
            float r = length(uv - 0.5);
            float ripple = sin(r * 60.0 - uTime * 2.5) * 0.5 + 0.5;
            float caust = pow(sin(uv.x * 30.0 + uTime) * sin(uv.y * 27.0 - uTime * 1.3) * 0.5 + 0.5, 6.0);
            vec3 col = mix(vec3(0.02, 0.12, 0.2), vec3(0.15, 0.5, 0.75), ripple * 0.35 + caust * 0.6);
            float edge = smoothstep(0.5, 0.42, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
            gl_FragColor = vec4(col, 0.55 * edge);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    mat.uniforms.uTime.value = R.time;
    mat.uniforms.uC.value = R.corruption;
  });
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} material={mat}>
      <planeGeometry args={[3, 3]} />
    </mesh>
  );
}

function Door({
  panel,
  frame,
  mDoor,
  mFrame,
  open,
  onAct,
}: {
  panel: BufferGeometry;
  frame: BufferGeometry;
  mDoor: Material;
  mFrame: Material;
  open: boolean;
  onAct: (a: Act) => void;
}) {
  const hinge = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const keyTaken = useNarr((s) => s.keyTaken);
  const finale = useNarr((s) => s.finale);
  useFrame((_, dt) => {
    const target = open ? -1.9 : 0;
    if (hinge.current)
      hinge.current.rotation.y += (target - hinge.current.rotation.y) * (1 - Math.exp(-dt * 2.2));
    if (light.current) {
      const flick =
        0.6 +
        Math.sin(R.time * 9) * 0.2 +
        (!R.reduced && Math.random() < R.corruption * 0.1 ? 0.8 : 0);
      light.current.intensity = open ? 12 : 0.8 * flick;
    }
  });
  const x0 = DOOR.x - DOOR.w / 2;
  return (
    <group position={[x0, 0, DOOR.z + 0.06]}>
      <mesh geometry={frame} material={mFrame} />
      {/* The void behind the door. */}
      <mesh position={[DOOR.w / 2, DOOR.h / 2, -0.02]}>
        <planeGeometry args={[DOOR.w, DOOR.h]} />
        <meshBasicMaterial color={[4, 4, 4.2]} toneMapped={false} />
      </mesh>
      <Interactable
        label={finale ? '…' : keyTaken ? 'Ouvrir la porte 404' : 'Porte 404 (verrouillée)'}
        disabled={finale}
        onInteract={() => onAct('door')}
        distance={2.4}
      >
        <group ref={hinge}>
          <mesh geometry={panel} material={mDoor} />
          <Text
            font={FONT_MONO}
            fontSize={0.16}
            position={[DOOR.w / 2, 1.62, 0.04]}
            color="#d9a441"
            anchorX="center"
            anchorY="middle"
          >
            404
          </Text>
          <mesh position={[DOOR.w - 0.12, 1.0, 0.05]}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshStandardMaterial color="#d9a441" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      </Interactable>
      <pointLight
        ref={light}
        position={[DOOR.w / 2, 1.2, 0.8]}
        color="#ff3344"
        distance={4}
        decay={2}
      />
    </group>
  );
}

function Mirror({ high, onAct }: { high: boolean; onAct: (a: Act) => void }) {
  return (
    <group position={[-HW + 0.04, 1.35, 0.6]} rotation-y={Math.PI / 2}>
      <mesh position-z={-0.02}>
        <boxGeometry args={[1.12, 2.02, 0.04]} />
        <meshStandardMaterial color="#2a1c10" roughness={0.4} metalness={0.4} />
      </mesh>
      <Interactable label="Le miroir" onInteract={() => onAct('mirror')} distance={2.6}>
        <mesh position-z={0.005}>
          <planeGeometry args={[1, 1.9]} />
          {high ? (
            <MeshReflectorMaterial
              mirror={1}
              resolution={512}
              mixBlur={0}
              mixStrength={1.4}
              blur={[0, 0]}
              color="#8892a0"
              metalness={0.6}
              roughness={0.15}
            />
          ) : (
            <meshStandardMaterial color="#0d1013" metalness={1} roughness={0.08} />
          )}
        </mesh>
      </Interactable>
    </group>
  );
}

/** The hall key: appears over the bed when le Gérant mentions it. */
function Key({ onAct }: { onAct: (a: Act) => void }) {
  const visible = useNarr((s) => s.keyVisible);
  const taken = useNarr((s) => s.keyTaken);
  const ref = useRef<Group>(null);
  const geo = useMemo(() => {
    const parts = [
      new TorusGeometry(0.06, 0.015, 8, 20).toNonIndexed(),
      new CylinderGeometry(0.012, 0.012, 0.22, 8)
        .rotateZ(Math.PI / 2)
        .translate(0.17, 0, 0)
        .toNonIndexed(),
      new BoxGeometry(0.02, 0.05, 0.012).translate(0.24, -0.03, 0).toNonIndexed(),
      new BoxGeometry(0.02, 0.035, 0.012).translate(0.2, -0.022, 0).toNonIndexed(),
    ];
    const m = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return m;
  }, []);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#d9a441',
        metalness: 1,
        roughness: 0.25,
        emissive: new Color('#7a4a10'),
        emissiveIntensity: 1.2,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = R.time;
    g.rotation.set(0.3, t * 1.2, Math.sin(t) * 0.2);
    g.position.y = 1.05 + Math.sin(t * 1.6) * 0.05;
    g.scale.setScalar(Math.min(1, g.scale.x + 0.02));
  });
  if (!visible || taken) return null;
  return (
    <Interactable
      label="Prendre la clé du hall"
      onInteract={() => onAct('key')}
      position={[2.6, 0, -1.2]}
      distance={2.6}
    >
      <group ref={ref} scale={0.01}>
        <mesh geometry={geo} material={mat} scale={1.6} />
        {/* Generous invisible hit box. */}
        <mesh visible={false}>
          <boxGeometry args={[0.6, 0.4, 0.4]} />
        </mesh>
      </group>
      <pointLight position={[0, 1.2, 0]} color="#ffcf7a" intensity={1.5} distance={2.5} />
    </Interactable>
  );
}

/** Shards orbiting in the room; more of them as the corruption rises. */
function Debris({ geometry, material }: { geometry: BufferGeometry; material: Material }) {
  const COUNT = 90;
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => {
    const r = rng(404);
    return Array.from({ length: COUNT }, () => ({
      p: [(r() - 0.5) * 7, 0.3 + r() * 2.7, (r() - 0.5) * 7] as const,
      s: 0.3 + r() * 1.4,
      w: r() * 6.28,
      sp: 0.2 + r() * 0.8,
    }));
  }, []);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = R.time;
    const n = Math.floor(COUNT * Math.min(1, R.corruption * 1.2 + R.explode));
    m.count = n;
    for (let i = 0; i < n; i++) {
      const d = seeds[i];
      dummy.position.set(
        d.p[0] + Math.sin(t * d.sp + d.w) * 0.3,
        d.p[1] + Math.sin(t * d.sp * 1.3 + d.w) * 0.2,
        d.p[2] + Math.cos(t * d.sp + d.w) * 0.3,
      );
      dummy.rotation.set(t * d.sp, t * d.sp * 0.7 + d.w, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, COUNT]} frustumCulled={false} />;
}

function Lights() {
  const bulb = useRef<PointLight>(null);
  const bulbMesh = useRef<Mesh>(null);
  useFrame(() => {
    const c = R.corruption;
    // The ceiling bulb dies in stutters as the room decays.
    const off = !R.reduced && Math.random() < c * 0.08 + R.spike * 0.2;
    const k = off ? 0.05 : 1 - c * 0.35 + Math.sin(R.time * 31) * 0.03 * c;
    if (bulb.current) bulb.current.intensity = 6 * k * (1 - R.finale);
    if (bulbMesh.current) bulbMesh.current.visible = !off;
  });
  return (
    <>
      <ambientLight intensity={0.12} color="#b8a0b0" />
      <hemisphereLight args={['#ffcfb0', '#1a0d10', 0.25]} />
      <pointLight ref={bulb} position={[0, 2.85, 0]} color="#ffd9a0" distance={10} decay={1.6} />
      <mesh ref={bulbMesh} position={[0, 2.95, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color={[3, 2.4, 1.6]} toneMapped={false} />
      </mesh>
      <pointLight position={[-3, 1.8, 2.5]} color="#2a7fb8" intensity={1.2} distance={5} />
    </>
  );
}
