import {
  BufferAttribute,
  BufferGeometry,
  MeshStandardMaterial,
  Vector3,
  type MeshStandardMaterialParameters,
} from 'three';
import { rng } from '@/lib/textures/procedural';

/**
 * "Corrupted" MeshStandardMaterial for room 404.
 *
 * Built by patching three's standard shader (onBeforeCompile) so lights, fog
 * and maps keep working, then adding:
 *  - vertex: triangles disassemble along their face normal (noise-driven,
 *    activated by uCorruption), shrink/rotate around their centroid, and the
 *    whole thing gets PS1-style vertex snapping. uExplode blows everything apart
 *    for the finale.
 *  - fragment: UV block offsets + RGB split on the color/emissive maps, wrong
 *    normals in random cells, fake z-fighting stripes with channel swaps, a red
 *    rim on detached triangles.
 *
 * Every material shares the same global uniform objects (`U`) — updating them
 * once per frame updates the whole room. Geometries must go through
 * `explodable()` to get the per-triangle attributes (aCenter, aFaceN, aRand).
 */
export const U = {
  uTime: { value: 0 },
  uCorruption: { value: 0 },
  uExplode: { value: 0 },
  /** Vertex snapping grid in NDC units per axis (0 = off). */
  uSnap: { value: 0 },
  /** Flicker rate multiplier (lower with reduced motion). */
  uRate: { value: 1 },
};

export interface CorruptOpts {
  /** Shifts when this object starts to decay (+ = earlier). */
  bias?: number;
  /** How far detached triangles drift during play (meters). */
  drift?: number;
  /** Strength of stripes / channel swaps. */
  stripes?: number;
}

const HEADER_COMMON = /* glsl */ `
uniform float uTime;
uniform float uCorruption;
uniform float uExplode;
uniform float uRate;
uniform float uBias;
float h404(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h404v(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;

const VERT_HEADER = /* glsl */ `
${HEADER_COMMON}
uniform float uSnap;
uniform float uDrift;
attribute vec3 aCenter;
attribute vec3 aFaceN;
attribute float aRand;
varying vec3 vCenter;
varying float vK;
// Cheap 3D value noise (0..1).
float n404(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h404v(i), b = h404v(i + vec3(1,0,0)), c = h404v(i + vec3(0,1,0)), d = h404v(i + vec3(1,1,0));
  float e = h404v(i + vec3(0,0,1)), g = h404v(i + vec3(1,0,1)), h = h404v(i + vec3(0,1,1)), k = h404v(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
}
vec3 rot404(vec3 v, vec3 axis, float a) {
  float s = sin(a), c = cos(a);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
`;

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
{
  // Triangle activation: noise patches that wander over time, + per-triangle randomness.
  float c = clamp(uCorruption + uBias, 0.0, 1.0);
  float nz = n404(aCenter * 0.9 + vec3(0.0, uTime * 0.07 * uRate, uTime * 0.05));
  float k = clamp((c * 1.35 - (aRand * 0.55 + nz * 0.65)) * 3.0, 0.0, 1.0);
  k = max(k * k, uExplode * (0.35 + 0.65 * aRand));
  vK = k;
  vCenter = aCenter;
  vec3 lp = transformed - aCenter;
  vec3 axis = normalize(vec3(aRand - 0.5, 0.7, fract(aRand * 7.31) - 0.5));
  lp = rot404(lp, axis, k * (1.5 + aRand * 4.0) + uExplode * uTime * (0.5 + aRand));
  lp *= 1.0 - 0.55 * k - 0.35 * uExplode;
  vec3 dir = normalize(aFaceN + 0.6 * (vec3(aRand, fract(aRand * 13.7), fract(aRand * 3.3)) - 0.5));
  float bob = sin(uTime * (0.6 + aRand) + aRand * 40.0) * 0.06 * k;
  transformed = aCenter + lp
    + dir * k * uDrift * (0.25 + aRand)
    + dir * uExplode * uExplode * (2.0 + aRand * 9.0)
    + vec3(0.0, bob, 0.0);
}
`;

const VERT_PROJECT = /* glsl */ `
#include <project_vertex>
if (uSnap > 0.0) {
  // PS1-style vertex snapping in clip space: geometry wobbles and jitters.
  vec4 p = gl_Position;
  p.xy = floor(p.xy / p.w * uSnap + 0.5) / uSnap * p.w;
  gl_Position = p;
}
`;

const FRAG_HEADER = /* glsl */ `
${HEADER_COMMON}
uniform float uStripes;
varying vec3 vCenter;
varying float vK;
// Row-based block displacement of a UV (texture "slips" sideways in bands).
vec2 glitchUv(vec2 uv, out float on) {
  float c = clamp(uCorruption + uBias, 0.0, 1.0);
  vec2 g = floor(uv * vec2(6.0, 18.0));
  float t = floor(uTime * 6.0 * uRate);
  on = step(1.0 - c * 0.45, h404(vec2(g.y, t)));
  uv.x += on * (h404(g + t) - 0.5) * 0.35;
  uv.y += on * (h404(g.yx + t * 1.3) - 0.5) * 0.04;
  return uv;
}
vec3 splitSample(sampler2D tex, vec2 uv) {
  float on;
  vec2 g = glitchUv(uv, on);
  float sp = (0.002 + 0.018 * uCorruption) * (0.4 + on);
  return vec3(texture2D(tex, g + vec2(sp, 0.0)).r, texture2D(tex, g).g, texture2D(tex, g - vec2(sp, 0.0)).b);
}
`;

const FRAG_MAP = /* glsl */ `
#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.rgb = diffuse * splitSample(map, vMapUv);
#endif
`;

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  totalEmissiveRadiance = emissive * splitSample(emissiveMap, vEmissiveMapUv);
#endif
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  // Wrong normals: whole cells of the surface light as if facing elsewhere.
  float c = clamp(uCorruption + uBias, 0.0, 1.0);
  float wn = step(1.0 - c * 0.55, h404v(floor(vCenter * 1.3) + floor(uTime * 0.7 * uRate)));
  normal = normalize(mix(normal, vec3(-normal.z, normal.x, -normal.y), wn));
}
`;

const FRAG_END = /* glsl */ `
{
  float c = clamp(uCorruption + uBias, 0.0, 1.0);
  // Fake z-fighting: screen-space stripes, alternating per frame-ish, in random cells.
  float zf = step(0.5, fract((gl_FragCoord.y + gl_FragCoord.x * 0.37) * 0.25 + floor(uTime * 20.0 * uRate) * 0.5));
  float region = step(1.0 - c * 0.45 * uStripes, h404v(floor(vCenter * 2.0) + floor(uTime * 3.0 * uRate)));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.bgr * 1.4 * zf, region * 0.85);
  // Detached triangles glow at their seams.
  gl_FragColor.rgb += vK * vec3(0.9, 0.08, 0.18) * (0.15 + 0.6 * c);
}
#include <dithering_fragment>
`;

/** MeshStandardMaterial with the corruption patch applied. */
export function corruptMaterial(
  params: MeshStandardMaterialParameters = {},
  opts: CorruptOpts = {},
) {
  const m = new MeshStandardMaterial(params);
  const local = {
    uBias: { value: opts.bias ?? 0 },
    uDrift: { value: opts.drift ?? 0.35 },
    uStripes: { value: opts.stripes ?? 1 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, local);
    shader.vertexShader =
      VERT_HEADER +
      shader.vertexShader
        .replace('#include <begin_vertex>', VERT_BEGIN)
        .replace('#include <project_vertex>', VERT_PROJECT);
    shader.fragmentShader =
      FRAG_HEADER +
      shader.fragmentShader
        .replace('#include <map_fragment>', FRAG_MAP)
        .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
        .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
        .replace('#include <dithering_fragment>', FRAG_END);
  };
  m.customProgramCacheKey = () => 'corrupt404';
  m.userData.corrupt = local;
  return m;
}

const tA = new Vector3();
const tB = new Vector3();
const tC = new Vector3();
const e1 = new Vector3();
const e2 = new Vector3();

/**
 * Converts a geometry to non-indexed triangles and adds per-triangle
 * attributes: aCenter (centroid, object space), aFaceN (face normal), aRand.
 * Disposes the source geometry.
 */
export function explodable(src: BufferGeometry, seed = 404): BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  src.dispose();
  const pos = g.attributes.position;
  const n = pos.count;
  const center = new Float32Array(n * 3);
  const faceN = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  const r = rng(seed);
  for (let i = 0; i + 2 < n; i += 3) {
    tA.fromBufferAttribute(pos, i);
    tB.fromBufferAttribute(pos, i + 1);
    tC.fromBufferAttribute(pos, i + 2);
    const cx = (tA.x + tB.x + tC.x) / 3;
    const cy = (tA.y + tB.y + tC.y) / 3;
    const cz = (tA.z + tB.z + tC.z) / 3;
    e1.subVectors(tB, tA);
    e2.subVectors(tC, tA);
    e1.cross(e2).normalize();
    const rv = r();
    for (let j = 0; j < 3; j++) {
      const k = (i + j) * 3;
      center[k] = cx;
      center[k + 1] = cy;
      center[k + 2] = cz;
      faceN[k] = e1.x;
      faceN[k + 1] = e1.y;
      faceN[k + 2] = e1.z;
      rand[i + j] = rv;
    }
  }
  g.setAttribute('aCenter', new BufferAttribute(center, 3));
  g.setAttribute('aFaceN', new BufferAttribute(faceN, 3));
  g.setAttribute('aRand', new BufferAttribute(rand, 1));
  return g;
}
