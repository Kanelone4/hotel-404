import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, PerspectiveCamera, ShaderMaterial } from 'three';
import { rng } from '@/lib/textures/procedural';
import { sharedUniforms, FLASH_GLSL } from './state';
import { H } from './layout';

/** Volumes to fill: [min x, min z, max x, max z]. */
const VOLUMES: [number, number, number, number][] = [
  [-3.4, -2.9, 1.9, 1.9],
  [-0.55, 2, 0.55, 4.9],
  [2.05, -2.95, 4.45, -0.45],
];

/**
 * Suspended dust: nearly invisible in the dark, it ignites inside the torch
 * beam (cone test per particle in the vertex shader) and faintly near the bulb.
 */
export function Dust({ count }: { count: number }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);

  const geo = useMemo(() => {
    const r = rng(2370);
    const areas = VOLUMES.map(([x0, z0, x1, z1]) => (x1 - x0) * (z1 - z0));
    const total = areas.reduce((a, b) => a + b, 0);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    let i = 0;
    VOLUMES.forEach(([x0, z0, x1, z1], v) => {
      const n = v === VOLUMES.length - 1 ? count - i : Math.round((count * areas[v]) / total);
      for (let k = 0; k < n && i < count; k++, i++) {
        pos[i * 3] = x0 + r() * (x1 - x0);
        pos[i * 3 + 1] = 0.1 + r() * (H - 0.2);
        pos[i * 3 + 2] = z0 + r() * (z1 - z0);
        for (let j = 0; j < 4; j++) seed[i * 4 + j] = r();
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 4));
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...sharedUniforms, uPixel: { value: 700 } },
        vertexShader: /* glsl */ `
          ${FLASH_GLSL}
          attribute vec4 aSeed;
          uniform float uPixel;
          varying float vLight;
          void main() {
            vec3 p = position;
            float t = uTime * (0.2 + aSeed.w * 0.25);
            // Brownian-ish drift: two incommensurate sines per axis.
            p.x += sin(t * 0.7 + aSeed.x * 6.28) * 0.12 + sin(t * 0.23 + aSeed.y * 9.0) * 0.2;
            p.z += cos(t * 0.6 + aSeed.y * 6.28) * 0.12 + cos(t * 0.19 + aSeed.z * 7.0) * 0.2;
            p.y += sin(t * 0.5 + aSeed.z * 6.28) * 0.08;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float dist = max(-mv.z, 0.05);
            float bulb = uBulb * 0.2 / (1.0 + dot(p - uBulbPos, p - uBulbPos) * 2.5);
            // Fade motes right in front of the lens (would read as big blobs).
            float nearFade = smoothstep(0.2, 0.7, dist);
            vLight = (flashAt(p) * 1.8 + bulb + 0.01) * nearFade * (0.5 + aSeed.x);
            gl_PointSize = clamp((0.0025 + aSeed.w * 0.004) * uPixel / dist, 1.0, 7.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vLight;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * vLight * a, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
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
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 70;
    mat.uniforms.uPixel.value = size.height / (2 * Math.tan((fov * Math.PI) / 360));
  });

  return <points geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />;
}
