import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, RenderTexture, Text } from '@react-three/drei';
import type { Group, PointLight, ShaderMaterial, PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { FONT_DISPLAY, FONT_MONO } from '@/lib/loaders/fonts';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { decoDrawing, puzzleSheet, type DecoKind } from './textures';
import { fx } from './state';
import { HX, HZ, PHOTO, PUZZLE_SIZE, PUZZLE_XS, PUZZLE_Y } from './layout';
import type { Vec3 } from '@/types/game';

// ─── Puzzle: three sheets to turn upright ─────────────────────────────────

export interface PuzzleProps {
  /** Cumulative quarter turns per sheet; a sheet is upright when turns % 4 === 0. */
  turns: number[];
  enabled: boolean;
  solved: boolean;
  onTurn: (i: number) => void;
}

function Sheet({ i, turns, enabled, solved, onTurn }: { i: number } & Omit<PuzzleProps, 'turns'> & { turns: number }) {
  const ref = useRef<Group>(null);
  const tex = useMemo(() => puzzleSheet(i), [i]);
  // Initial angle only: later turns are eased in useFrame (a changing prop would snap).
  const initialAngle = useRef(-turns * (Math.PI / 2)).current;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    // Clockwise quarter turns, eased.
    const target = -turns * (Math.PI / 2);
    g.rotation.z += (target - g.rotation.z) * (1 - Math.exp(-dt * 9));
  });
  const x = PUZZLE_XS[i];
  return (
    <Interactable
      label={solved ? 'Le dessin' : enabled ? 'Tourner le dessin' : 'Un dessin punaisé'}
      distance={2.6}
      onInteract={() => {
        if (solved) {
          ui().showToast('« LA CHAMBRE 404 EXISTE ». Le crayon a percé le papier.');
          return;
        }
        if (!enabled) {
          ui().showToast('Punaisé de travers. Quelqu’un les a tournés exprès. Vous n’osez pas y toucher… pas encore.');
          return;
        }
        onTurn(i);
      }}
      position={[x, PUZZLE_Y, -HZ + 0.02]}
    >
      <group ref={ref} rotation-z={initialAngle}>
        <mesh receiveShadow>
          <planeGeometry args={[PUZZLE_SIZE, PUZZLE_SIZE]} />
          <meshStandardMaterial map={tex} roughness={0.95} />
        </mesh>
        {/* Thumbtack (top center of the sheet: shows its orientation) */}
        <mesh position={[0, PUZZLE_SIZE / 2 - 0.028, 0.008]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.008, 12]} />
          <meshStandardMaterial color={['#d1262f', '#3b6fc4', '#f2d27a'][i]} roughness={0.4} />
        </mesh>
      </group>
    </Interactable>
  );
}

export function PuzzleDrawings(props: PuzzleProps) {
  return (
    <group>
      {PUZZLE_XS.map((_, i) => (
        <Sheet key={i} i={i} turns={props.turns[i]} enabled={props.enabled} solved={props.solved} onTurn={props.onTurn} />
      ))}
    </group>
  );
}

// ─── Decorative drawings ──────────────────────────────────────────────────

interface Deco {
  kind: DecoKind;
  pos: Vec3;
  rotY: number;
  tilt: number;
  caption: string;
}

const DECOS: Deco[] = [
  { kind: 'family', pos: [-HX + 0.012, 1.55, -1.15], rotY: Math.PI / 2, tilt: 0.04, caption: '« PAPA MAMAN MOI ». Le quatrième personnage a été noirci jusqu’à trouer la feuille.' },
  { kind: 'rainbow', pos: [-HX + 0.012, 1.4, 0.2], rotY: Math.PI / 2, tilt: -0.06, caption: 'Un arc-en-ciel. Signé « LEO », avec le E à l’envers.' },
  { kind: 'wardrobe', pos: [HX - 0.012, 1.55, -0.38], rotY: -Math.PI / 2, tilt: 0.05, caption: '« IL EST GENTIL ». L’armoire du dessin est la même que celle-ci.' },
  { kind: 'hotel', pos: [-0.85, 1.5, HZ - 0.012], rotY: Math.PI, tilt: -0.03, caption: '« L’OTEL ». Une seule fenêtre est coloriée en rouge.' },
];

export function DecoDrawings() {
  const tex = useMemo(() => DECOS.map((d, i) => decoDrawing(d.kind, 70 + i)), []);
  return (
    <group>
      {DECOS.map((d, i) => (
        <Interactable key={d.kind} label="Un dessin" distance={2.4} onInteract={() => ui().showToast(d.caption)} position={d.pos} rotation={[0, d.rotY, d.tilt]}>
          <mesh receiveShadow>
            <planeGeometry args={[0.46, 0.38]} />
            <meshStandardMaterial map={tex[i]} roughness={0.95} />
          </mesh>
          {/* Tape strips */}
          {[-0.19, 0.19].map((x) => (
            <mesh key={x} position={[x, 0.18, 0.003]} rotation-z={x > 0 ? -0.6 : 0.6}>
              <planeGeometry args={[0.09, 0.03]} />
              <meshStandardMaterial color="#efe3b8" transparent opacity={0.7} roughness={0.6} />
            </mesh>
          ))}
        </Interactable>
      ))}
    </group>
  );
}

// ─── The twist: a "photo" of room 404, rendered live ──────────────────────

/** Glitch post on the offscreen render: line tearing, RGB split, grain, scanlines. */
const photoVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const photoFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime;
uniform float uGlitch;
uniform float uDim;
varying vec2 vUv;
float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // Horizontal tearing on random bands, more often when uGlitch is high.
  float band = floor(uv.y * 28.0);
  float tick = floor(uTime * 14.0);
  float tear = step(0.985 - uGlitch * 0.12, rand(vec2(band, tick)));
  uv.x += tear * (rand(vec2(tick, band)) - 0.5) * (0.06 + uGlitch * 0.12);
  // Chromatic split.
  float s = 0.003 + uGlitch * 0.008 * (0.5 + 0.5 * sin(uTime * 9.0));
  vec3 c = vec3(texture2D(uTex, uv + vec2(s, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(s, 0.0)).b);
  // Grain + scanlines + photo vignette.
  c += (rand(uv * vec2(311.0, 197.0) + fract(uTime)) - 0.5) * 0.09;
  c *= 0.88 + 0.12 * sin(uv.y * 360.0);
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 1.6;
  gl_FragColor = vec4(max(c, 0.0) * uDim, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Mini scene rendered into the photo: a dark corridor, door 404, a child facing it. */
function Room404Scene() {
  const cam = useRef<ThreePerspectiveCamera>(null);
  const red = useRef<PointLight>(null);
  const kid = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cam.current) {
      // Very slow creep toward the door.
      cam.current.position.z = 2.6 - ((t * 0.03) % 0.8);
      cam.current.position.x = Math.sin(t * 0.2) * 0.05;
      cam.current.lookAt(0, 1.0, -1);
    }
    if (red.current) {
      const f = Math.sin(t * 13) * Math.sin(t * 3.1) > 0.85 ? 0.2 : 1;
      red.current.intensity = (2.5 + Math.sin(t * 2) * 0.6) * f;
    }
    // Once the drawings are solved, the child turns around.
    if (kid.current) {
      const target = fx.solved ? Math.PI : 0;
      kid.current.rotation.y += (target - kid.current.rotation.y) * 0.02;
    }
  });
  return (
    <>
      <color attach="background" args={['#040203']} />
      <fog attach="fog" args={['#040203', 1.5, 6]} />
      <PerspectiveCamera ref={cam} makeDefault manual aspect={1} fov={48} position={[0, 1.1, 2.6]} near={0.05} far={20} />
      <ambientLight intensity={0.08} />
      <pointLight ref={red} position={[0, 2.1, -0.6]} color="#ff2a2a" intensity={2.5} distance={5} decay={1.5} />
      {/* Corridor */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3, 8]} />
        <meshStandardMaterial color="#2a1a18" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.3, -1.05]}>
        <planeGeometry args={[3, 2.6]} />
        <meshStandardMaterial color="#3a2a2a" roughness={1} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.3, 1]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2}>
          <planeGeometry args={[5, 2.6]} />
          <meshStandardMaterial color="#2c2222" roughness={1} />
        </mesh>
      ))}
      {/* Door 404 */}
      <mesh position={[0, 1.0, -1.0]}>
        <boxGeometry args={[0.9, 2.0, 0.05]} />
        <meshStandardMaterial color="#1a0f0e" roughness={0.6} />
      </mesh>
      <Text font={FONT_MONO} position={[0, 1.55, -0.96]} fontSize={0.2} color="#ff3b30" anchorX="center" anchorY="middle">
        404
        <meshBasicMaterial color="#ff4a3a" toneMapped={false} />
      </Text>
      {/* Light under the door */}
      <mesh position={[0, 0.01, -0.95]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.85, 0.06]} />
        <meshBasicMaterial color="#ffd0a0" toneMapped={false} />
      </mesh>
      {/* The child (silhouette), facing the door */}
      <group ref={kid} position={[0.15, 0, 0.1]}>
        <mesh position={[0, 0.42, 0]}>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color="#0c0808" roughness={1} />
        </mesh>
        <mesh position={[0, 0.88, 0]}>
          <sphereGeometry args={[0.13, 12, 10]} />
          <meshStandardMaterial color="#0c0808" roughness={1} />
        </mesh>
        {/* Eyes on the face side (+Z after turning around) */}
        {[-0.045, 0.045].map((x) => (
          <mesh key={x} position={[x, 0.9, -0.125]} rotation-y={Math.PI}>
            <circleGeometry args={[0.015, 8]} />
            <meshBasicMaterial color="#f2efe6" toneMapped={false} />
          </mesh>
        ))}
        {/* The teddy, held by one arm */}
        <mesh position={[0.17, 0.45, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#3a2414" roughness={1} />
        </mesh>
      </group>
    </>
  );
}

export function Photo404({ heavy }: { heavy: boolean }) {
  const mat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTex: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0.1 }, uDim: { value: 1 } }),
    [],
  );
  useFrame(({ clock }, dt) => {
    uniforms.uTime.value = clock.elapsedTime;
    const g = fx.solved ? 0.9 : fx.uneaseOn ? 0.35 : 0.1;
    uniforms.uGlitch.value += (g * (fx.reducedMotion ? 0.35 : 1) - uniforms.uGlitch.value) * Math.min(1, dt * 2);
    uniforms.uDim.value = 1.15 * Math.max(0, 1 - fx.dying * 1.4);
  });
  const size = heavy ? 256 : 160;
  return (
    <group position={PHOTO} rotation={[0, -Math.PI / 2, 0.07]}>
      <Interactable
        label="Une photo ?"
        distance={2.3}
        onInteract={() => {
          sfx.glitch(PHOTO, 0.2);
          ui().showToast(
            fx.solved
              ? 'L’enfant sur la photo s’est retourné. Il vous regarde.'
              : 'Ce n’est pas un dessin. C’est une photo. Prise de l’autre côté d’une porte qui n’existe pas.',
          );
        }}
      >
        {/* Polaroid card */}
        <mesh position={[0, -0.02, -0.002]}>
          <planeGeometry args={[0.26, 0.31]} />
          <meshStandardMaterial color="#f3f0e8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.02, 0.001]}>
          <planeGeometry args={[0.22, 0.22]} />
          <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={photoVert} fragmentShader={photoFrag}>
            <RenderTexture attach="uniforms-uTex-value" width={size} height={size} generateMipmaps={false}>
              <Room404Scene />
            </RenderTexture>
          </shaderMaterial>
        </mesh>
        <Text font={FONT_DISPLAY} position={[0, -0.135, 0.002]} fontSize={0.026} color="#2a4d8f" anchorX="center" anchorY="middle" rotation-z={-0.04}>
          ma chambre (la vraie)
        </Text>
        {/* Tape */}
        <mesh position={[0, 0.14, 0.003]} rotation-z={0.1}>
          <planeGeometry args={[0.1, 0.035]} />
          <meshStandardMaterial color="#efe3b8" transparent opacity={0.75} roughness={0.6} />
        </mesh>
      </Interactable>
    </group>
  );
}
