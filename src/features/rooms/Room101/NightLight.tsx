import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Vector3, type Group, type Sprite, type MeshStandardMaterial, type PointLight, type ShaderMaterial } from 'three';
import { glow } from '@/lib/textures/procedural';
import { fx } from './state';
import { HX, HZ, NIGHTSTAND, PROJECTOR, ROOM } from './layout';

/**
 * Star projector shader, drawn on an inner shell of the room (BackSide box
 * inset by a few mm). For each fragment we take the direction from the
 * projector to the surface, rotate it with time, and look it up in a 3D
 * cell grid on the unit sphere: every cell may own one star. The result is a
 * true projection — stars stretch on the walls, shrink near the lamp, and are
 * occluded by furniture through the depth test. One draw call.
 */
const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const frag = /* glsl */ `
uniform vec3 uOrigin;
uniform float uTime;
uniform float uRot;
uniform float uIntensity;
varying vec3 vWorld;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

void main() {
  vec3 d = vWorld - uOrigin;
  float dist = length(d);
  vec3 n = rotY(uRot) * (d / dist);

  // ── Stars: one candidate per cell of a 3D grid sampled on the sphere ──
  vec3 p = n * 8.0;
  vec3 c = floor(p);
  vec3 f = fract(p);
  float h = hash3(c);
  vec3 o = vec3(hash3(c + 1.3), hash3(c + 7.1), hash3(c + 3.7)) * 0.5 + 0.25;
  vec3 q = f - o;
  q -= n * dot(q, n);              // flatten onto the tangent plane
  // tangent basis for the 5-point star shape
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float ang = atan(dot(q, t2), dot(q, t1)) + h * 6.28;
  float shape = h > 0.75 ? 1.0 + 0.45 * cos(5.0 * ang) : 1.0;  // a quarter are 5-point stars
  float r = length(q) * shape;
  float size = mix(0.06, 0.13, hash3(c + 5.0));
  float star = smoothstep(size, size * 0.35, r) * step(0.3, h);
  // gentle twinkle
  star *= 0.65 + 0.35 * sin(uTime * (0.8 + h * 2.5) + h * 40.0);

  // ── Moon: a crescent at a fixed direction in the rotating frame ──
  vec3 m = normalize(vec3(0.75, 0.35, -0.55));
  vec3 m2 = normalize(m + vec3(0.05, 0.03, 0.03));
  float moon = smoothstep(0.985, 0.988, dot(n, m)) * (1.0 - smoothstep(0.985, 0.988, dot(n, m2)));

  // Lamp shade blocks the lower hemisphere.
  float cone = smoothstep(-0.3, 0.05, n.y);
  float atten = 1.6 / (1.0 + dist * dist * 0.35);
  vec3 col = mix(vec3(1.0, 0.82, 0.52), vec3(0.62, 0.74, 1.0), step(0.6, h));
  vec3 outc = (col * star + vec3(1.0, 0.9, 0.65) * moon * 1.3) * cone * atten * uIntensity;
  gl_FragColor = vec4(outc, 1.0);
}
`;

const BASE_LIGHT = 2.6;

export function NightLight({ heavy }: { heavy: boolean }) {
  const light = useRef<PointLight>(null);
  const shadowClock = useRef(0);
  const shell = useRef<ShaderMaterial>(null);
  const bulb = useRef<MeshStandardMaterial>(null);
  const halo = useRef<Sprite>(null);
  const dome = useRef<Group>(null);
  const uniforms = useMemo(
    () => ({
      uOrigin: { value: new Vector3(...PROJECTOR).add(new Vector3(0, -0.02, 0)) },
      uTime: { value: 0 },
      uRot: { value: 0 },
      uIntensity: { value: 1 },
    }),
    [],
  );
  const haloTex = useMemo(() => glow('#ffc879'), []);
  const warm = useMemo(() => new Color('#ffb46b'), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // Breathing pulse (slow, like a sleeping child).
    let k = 0.82 + 0.18 * Math.sin(t * 0.9) * (fx.reducedMotion ? 0.4 : 1);
    // Unease: occasional dips.
    if (fx.uneaseOn && fx.unease > 20 && !fx.reducedMotion) {
      const dip = Math.sin(t * 7.3) * Math.sin(t * 0.37);
      if (dip > 0.93) k *= 0.35;
    }
    // Exit: brief flicker, then dead.
    if (fx.dying > 0) {
      const d = fx.dying;
      const flick = d < 0.35 && !fx.reducedMotion ? (Math.sin(t * 60) > 0 ? 1 : 0.15) : 1;
      k *= Math.max(0, 1 - d * 1.6) * flick;
    }
    const L = light.current;
    if (L) {
      L.intensity = BASE_LIGHT * k;
      // Point-light shadows cost 6 scene passes: refresh them ~4×/s only (props move slowly).
      L.shadow.autoUpdate = false;
      shadowClock.current -= dt;
      if (shadowClock.current <= 0) {
        shadowClock.current = 0.25;
        L.shadow.needsUpdate = true;
      }
    }
    if (bulb.current) bulb.current.emissiveIntensity = 2.2 * k;
    if (halo.current) halo.current.scale.setScalar(0.35 + 0.1 * k);
    uniforms.uTime.value = t;
    uniforms.uRot.value += dt * (fx.reducedMotion ? 0.012 : 0.04) * (fx.uneaseOn && fx.unease > 45 ? -1.6 : 1);
    uniforms.uIntensity.value = k * 0.9;
    if (dome.current) dome.current.rotation.y = -uniforms.uRot.value;
    if (shell.current) shell.current.visible = k > 0.01;
  });

  return (
    <group>
      {/* Projection shell (inset from the walls) */}
      <mesh position={[0, ROOM.h / 2, 0]} renderOrder={2}>
        <boxGeometry args={[HX * 2 - 0.006, ROOM.h - 0.006, HZ * 2 - 0.006]} />
        <shaderMaterial
          ref={shell}
          uniforms={uniforms}
          vertexShader={vert}
          fragmentShader={frag}
          side={BackSide}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Night-light: a little dome on the nightstand */}
      <group position={[NIGHTSTAND.x, NIGHTSTAND.h, NIGHTSTAND.z]}>
        <mesh position={[0, 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.09, 0.06, 24]} />
          <meshStandardMaterial color="#f2e6f0" roughness={0.5} />
        </mesh>
        <group ref={dome} position={[0, 0.06, 0]}>
          <mesh>
            <sphereGeometry args={[0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial ref={bulb} color="#ffe0b0" emissive={warm} emissiveIntensity={2.2} toneMapped={false} transparent opacity={0.92} />
          </mesh>
          {/* Star cut-outs on the dome */}
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.066, 0.035 + (i % 2) * 0.012, Math.sin(a) * 0.066]}>
                <sphereGeometry args={[0.008, 6, 4]} />
                <meshBasicMaterial color="#fff6dc" toneMapped={false} />
              </mesh>
            );
          })}
        </group>
        <sprite ref={halo} position={[0, 0.1, 0]}>
          <spriteMaterial map={haloTex} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.5} toneMapped={false} />
        </sprite>
        <pointLight
          ref={light}
          position={[0, 0.16, 0]}
          color="#ffb877"
          intensity={BASE_LIGHT}
          distance={7}
          decay={1.6}
          castShadow={heavy}
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-bias={-0.004}
          shadow-camera-near={0.05}
          shadow-camera-far={7}
        />
      </group>
    </group>
  );
}
