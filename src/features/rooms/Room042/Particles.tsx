import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { rng } from '@/lib/textures/procedural';
import { ROOM } from './layout';
import { shared } from './state';

/** Pixel scale for world-sized points: bufferHeight / (2·tan(fov/2)). */
const pointScale = { value: 600 };

function usePointScale() {
  useFrame(({ camera, size, viewport }) => {
    const fov = (camera as PerspectiveCamera).fov ?? 70;
    pointScale.value = (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  });
}

/* Bubble sprite: thin bright rim + specular dot, almost empty center. */
const BUBBLE_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float rim = smoothstep(0.55, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
    float spec = smoothstep(0.28, 0.0, length(c - vec2(-0.16, -0.16)));
    float a = (rim * 0.85 + spec + 0.06) * vAlpha;
    gl_FragColor = vec4(vec3(0.78, 0.96, 1.0) * a, a);
  }
`;

/* ──────────────────────────────────────────────────────────────────────────
 * Ambient bubbles: analytic motion on the GPU (no CPU updates).
 * aSeed = (x, z, phase, speed). Columns rise from "vents" (under the bed,
 * the wardrobe crack, the fishbowl, the drain) plus scattered strays.
 * ────────────────────────────────────────────────────────────────────────── */
const VENTS: [number, number][] = [
  [-1.6, -3.3],
  [-3.6, 0.4],
  [3.55, -0.6],
  [1.2, 2.2],
  [-0.2, -0.8],
  [2.5, 3.0],
];

export function Bubbles({ count }: { count: number }) {
  usePointScale();
  const { geometry, material } = useMemo(() => {
    const r = rng(42);
    const seeds = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x: number;
      let z: number;
      if (i < count * 0.65) {
        const v = VENTS[i % VENTS.length];
        x = v[0] + (r() - 0.5) * 0.25;
        z = v[1] + (r() - 0.5) * 0.25;
      } else {
        x = ROOM.minX + 0.3 + r() * (ROOM.maxX - ROOM.minX - 0.6);
        z = ROOM.minZ + 0.3 + r() * (ROOM.maxZ - ROOM.minZ - 0.6);
      }
      seeds.set([x, z, r(), 0.25 + r() * 0.45], i * 4);
      sizes[i] = 0.012 + Math.pow(r(), 3) * 0.05;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    g.setAttribute('aSize', new BufferAttribute(sizes, 1));
    // Positions are computed in the shader: give a generous bounding sphere.
    g.boundingSphere = null;
    g.computeBoundingSphere();
    g.boundingSphere!.center.set(0, ROOM.height / 2, 0);
    g.boundingSphere!.radius = 8;
    const m = new ShaderMaterial({
      uniforms: { uTime: shared.uTime, uDrain: shared.uDrain, uScale: pointScale, uHeight: { value: ROOM.height } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uDrain; uniform float uScale; uniform float uHeight;
        attribute vec4 aSeed; attribute float aSize;
        varying float vAlpha;
        void main() {
          float y = fract(aSeed.z + uTime * aSeed.w / uHeight) * uHeight;
          float ph = aSeed.z * 40.0;
          // Wobble grows as the bubble rises (it starts to zig-zag).
          float wob = 0.03 + y * 0.025;
          vec3 p = vec3(aSeed.x + sin(uTime * 3.1 + ph) * wob, y, aSeed.y + cos(uTime * 2.6 + ph * 1.3) * wob);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (1.0 + y * 0.12) * uScale / -mv.z;
          vAlpha = smoothstep(0.0, 0.25, y) * smoothstep(uHeight, uHeight - 0.3, y) * (1.0 - uDrain) * smoothstep(14.0, 4.0, -mv.z);
        }`,
      fragmentShader: BUBBLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    m.premultipliedAlpha = true;
    return { geometry: g, material: m };
  }, [count]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Plankton / dust: slow 3D drift wrapped inside the room box.
 * ────────────────────────────────────────────────────────────────────────── */
export function Plankton({ count }: { count: number }) {
  usePointScale();
  const { geometry, material } = useMemo(() => {
    const r = rng(7);
    const base = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base.set([ROOM.minX + r() * 8, r() * ROOM.height, ROOM.minZ + r() * 10], i * 3);
      ph[i] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(base, 3));
    g.setAttribute('aPh', new BufferAttribute(ph, 1));
    const m = new ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        uDrain: shared.uDrain,
        uScale: pointScale,
        uMin: { value: new Vector3(ROOM.minX, 0, ROOM.minZ) },
        uSize: { value: new Vector3(ROOM.maxX - ROOM.minX, ROOM.height, ROOM.maxZ - ROOM.minZ) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uDrain; uniform float uScale; uniform vec3 uMin; uniform vec3 uSize;
        attribute float aPh;
        varying float vAlpha; varying float vWarm;
        void main() {
          float t = uTime;
          vec3 p = position + vec3(
            sin(t * 0.13 + aPh * 6.28) * 0.4 + t * 0.015,
            sin(t * 0.09 + aPh * 12.0) * 0.25 + t * 0.01 * (aPh - 0.3),
            cos(t * 0.11 + aPh * 9.0) * 0.4);
          p = uMin + mod(p - uMin, uSize);
          // While draining, the plankton settles.
          p.y = mix(p.y, 0.02, uDrain * uDrain);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float twinkle = 0.6 + 0.4 * sin(t * (1.0 + aPh * 3.0) + aPh * 50.0);
          gl_PointSize = (0.006 + aPh * 0.008) * uScale / -mv.z;
          vAlpha = twinkle * smoothstep(9.0, 0.6, -mv.z) * smoothstep(0.15, 0.6, -mv.z) * (1.0 - uDrain * 0.85);
          vWarm = step(0.93, aPh);
        }`,
      fragmentShader: /* glsl */ `
        varying float vAlpha; varying float vWarm;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d) * vAlpha * 0.55;
          vec3 c = mix(vec3(0.6, 0.85, 0.8), vec3(1.0, 0.75, 0.45), vWarm);
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Exhale bubbles: a small CPU pool spawned in front of the camera on every
 * breath out. `emitExhale(origin)` can be called from anywhere.
 * ────────────────────────────────────────────────────────────────────────── */
const POOL = 64;
const queue: Vector3[] = [];
export function emitExhale(origin: Vector3) {
  queue.push(origin.clone());
}

export function ExhaleBubbles() {
  usePointScale();
  const state = useRef({ next: 0 });
  const { geometry, material, pos, vel, life, size } = useMemo(() => {
    const pos = new Float32Array(POOL * 3);
    const vel = new Float32Array(POOL * 3);
    const life = new Float32Array(POOL);
    const size = new Float32Array(POOL);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aLife', new BufferAttribute(life, 1));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      uniforms: { uScale: pointScale },
      vertexShader: /* glsl */ `
        uniform float uScale;
        attribute float aLife; attribute float aSize;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 0.05);
          vAlpha = clamp(aLife, 0.0, 1.0) * smoothstep(0.08, 0.3, -mv.z);
        }`,
      fragmentShader: BUBBLE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    m.premultipliedAlpha = true;
    return { geometry: g, material: m, pos, vel, life, size };
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    while (queue.length) {
      const o = queue.shift()!;
      const n = 7 + Math.floor(Math.random() * 6);
      for (let k = 0; k < n; k++) {
        const i = state.current.next;
        state.current.next = (i + 1) % POOL;
        pos[i * 3] = o.x + (Math.random() - 0.5) * 0.08;
        pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * 0.06;
        pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * 0.08;
        vel[i * 3] = (Math.random() - 0.5) * 0.2;
        vel[i * 3 + 1] = 0.35 + Math.random() * 0.5;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        life[i] = 1.6 + Math.random() * 1.2 + k * 0.05;
        size[i] = 0.01 + Math.random() * 0.02;
      }
    }
    for (let i = 0; i < POOL; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt * 0.6;
      vel[i * 3 + 1] = Math.min(vel[i * 3 + 1] + dt * 0.6, 1.1);
      pos[i * 3] += (vel[i * 3] + Math.sin(t * 9 + i) * 0.08) * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(t * 8 + i) * 0.08) * dt;
      // Bubbles pool against the ceiling and burst.
      if (pos[i * 3 + 1] > ROOM.height - 0.04) life[i] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aLife.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
