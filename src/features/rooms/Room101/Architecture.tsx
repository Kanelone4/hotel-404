import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, Vector2, type Texture } from 'three';
import { wood } from '@/lib/textures/procedural';
import { wallpaperTile, rugTexture } from './textures';
import { fx, isSeen } from './state';
import { HX, HZ, ROOM, RUG } from './layout';
import type { Vec3 } from '@/types/game';

const WAINSCOT = 0.9;
const PAPER_H = ROOM.h - WAINSCOT;

interface WallDef {
  key: string;
  pos: Vec3;
  rotY: number;
  width: number;
  /** Center of the wall, used for the "is it looked at" test. */
  look: Vec3;
}

const WALLS: WallDef[] = [
  { key: 'back', pos: [0, 0, -HZ], rotY: 0, width: ROOM.w, look: [0, 1.6, -HZ] },
  { key: 'front', pos: [0, 0, HZ], rotY: Math.PI, width: ROOM.w, look: [0, 1.6, HZ] },
  { key: 'left', pos: [-HX, 0, 0], rotY: Math.PI / 2, width: ROOM.d, look: [-HX, 1.6, 0] },
  { key: 'right', pos: [HX, 0, 0], rotY: -Math.PI / 2, width: ROOM.d, look: [HX, 1.6, 0] },
];

/**
 * Wallpaper material: standard PBR, but the map lookup is replaced so each
 * motif tile can independently switch to the "changed" variant once its hash
 * falls under `uMix`. uMix only grows while the wall is NOT on screen —
 * the pattern is never seen changing, only *having* changed.
 */
function makeWallpaper(a: Texture, b: Texture, repeat: [number, number]) {
  const uniforms = { uMix: { value: 0 }, uMap2: { value: b }, uRepeat: { value: new Vector2(...repeat) } };
  const mat = new MeshStandardMaterial({ map: a, roughness: 0.92, color: '#ffffff' });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D uMap2;\nuniform float uMix;\nuniform vec2 uRepeat;')
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
#ifdef USE_MAP
  vec2 wUv = vMapUv * uRepeat;
  vec2 tile = floor(wUv);
  // Per-tile hash: tiles with h < uMix show the altered motif.
  float h = fract(sin(dot(tile, vec2(12.9898, 78.233))) * 43758.5453);
  float m = step(h, uMix);
  vec4 calm = texture2D(map, wUv);
  vec4 changed = texture2D(uMap2, wUv);
  diffuseColor *= mix(calm, changed, m);
#endif
`,
      );
  };
  mat.customProgramCacheKey = () => 'r101-wallpaper';
  return { mat, uniforms };
}

export function Architecture() {
  const floorTex = useMemo(() => wood([3, 3], '#9a7650', 101), []);
  const rug = useMemo(rugTexture, []);
  const walls = useMemo(() => {
    const a = wallpaperTile(false);
    const b = wallpaperTile(true);
    return WALLS.map((w) => ({ ...w, ...makeWallpaper(a, b, [w.width / 0.55, PAPER_H / 0.55]) }));
  }, []);

  // Wallpaper escalation: creeps forward only on walls behind you.
  useFrame(({ camera }, dt) => {
    if (!fx.uneaseOn) return;
    const target = Math.min(0.42, fx.unease / 220);
    for (const w of walls) {
      if (isSeen(camera, w.look, 0.1)) continue;
      const u = w.uniforms.uMix;
      u.value = Math.min(target, u.value + dt * 0.05);
    }
  });

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorTex} roughness={0.7} />
      </mesh>
      {/* Rug */}
      <mesh rotation-x={-Math.PI / 2} position={[RUG[0], 0.004, RUG[2]]} receiveShadow>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      {/* Ceiling — pale sky blue */}
      <mesh rotation-x={Math.PI / 2} position={[0, ROOM.h, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial color="#c9d6e6" roughness={1} />
      </mesh>

      {walls.map((w) => (
        <group key={w.key} position={w.pos} rotation-y={w.rotY}>
          {/* Wallpaper */}
          <mesh position={[0, WAINSCOT + PAPER_H / 2, 0]} material={w.mat} receiveShadow>
            <planeGeometry args={[w.width, PAPER_H]} />
          </mesh>
          {/* Painted wainscot + chair rail + skirting */}
          <mesh position={[0, WAINSCOT / 2, 0]} receiveShadow>
            <planeGeometry args={[w.width, WAINSCOT]} />
            <meshStandardMaterial color="#f1ece2" roughness={0.6} />
          </mesh>
          <mesh position={[0, WAINSCOT, 0.015]}>
            <boxGeometry args={[w.width, 0.04, 0.03]} />
            <meshStandardMaterial color="#e8dfcf" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.05, 0.01]}>
            <boxGeometry args={[w.width, 0.1, 0.02]} />
            <meshStandardMaterial color="#e2d8c6" roughness={0.5} />
          </mesh>
        </group>
      ))}

      <Door />
      <Window />
      <CeilingLamp />
    </group>
  );
}

/** Closed door on the front wall (behind the spawn). */
function Door() {
  return (
    <group position={[1.15, 0, HZ - 0.02]} rotation-y={Math.PI}>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[0.9, 2.04, 0.04]} />
        <meshStandardMaterial color="#efe8da" roughness={0.55} />
      </mesh>
      {[0.55, 1.45].map((y) => (
        <mesh key={y} position={[0, y, 0.025]}>
          <boxGeometry args={[0.6, y > 1 ? 0.75 : 0.6, 0.012]} />
          <meshStandardMaterial color="#e5dccb" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0.36, 1.0, 0.05]}>
        <sphereGeometry args={[0.03, 12, 8]} />
        <meshStandardMaterial color="#c9a45a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Hanging sign "Chut" */}
      <mesh position={[0.05, 1.55, 0.04]}>
        <boxGeometry args={[0.24, 0.12, 0.01]} />
        <meshStandardMaterial color="#a9c4e4" roughness={0.8} />
      </mesh>
      {/* Thin light line under the door (the corridor) */}
      <mesh position={[0, 0.005, 0.03]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.86, 0.02]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Window with moonlight on the left wall, curtains half-drawn. */
function Window() {
  return (
    <group position={[-HX + 0.01, 0, 1.25]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 1.55, 0]}>
        <planeGeometry args={[0.9, 1.0]} />
        <meshBasicMaterial color="#1c2a48" />
      </mesh>
      {/* Moon glow through the glass */}
      <mesh position={[0.22, 1.8, 0.005]}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color="#dfe8ff" toneMapped={false} />
      </mesh>
      {/* Frame + cross bars */}
      {[
        [0, 2.06, 1.0, 0.05],
        [0, 1.04, 1.0, 0.05],
        [0, 1.55, 0.9, 0.03],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <boxGeometry args={[w, h, 0.05]} />
          <meshStandardMaterial color="#f3efe6" roughness={0.5} />
        </mesh>
      ))}
      {[-0.48, 0, 0.48].map((x) => (
        <mesh key={x} position={[x, 1.55, 0.02]}>
          <boxGeometry args={[x === 0 ? 0.03 : 0.05, 1.05, 0.05]} />
          <meshStandardMaterial color="#f3efe6" roughness={0.5} />
        </mesh>
      ))}
      {/* Curtains */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.45, 0.08]} castShadow>
          <boxGeometry args={[0.32, 1.65, 0.03]} />
          <meshStandardMaterial color="#e9c6cf" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.32, 0.09]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.015, 0.015, 1.5, 8]} />
        <meshStandardMaterial color="#d8c9a8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Switched-off ceiling lamp: paper cloud. */
function CeilingLamp() {
  return (
    <group position={[0, ROOM.h, 0]}>
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.36, 4]} />
        <meshStandardMaterial color="#ddd" />
      </mesh>
      {[
        [0, -0.4, 0, 0.16],
        [0.14, -0.42, 0.02, 0.12],
        [-0.13, -0.43, -0.03, 0.11],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[s, 16, 12]} />
          <meshStandardMaterial color="#f3f1ea" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
