import { Vector3 } from 'three';

/**
 * Mutable per-frame state shared by the room's pieces (flashlight, dust,
 * inscription shader, silhouette…). Never React state — read in useFrame.
 */

/** Half-angle of the flashlight cone (radians). */
export const FLASH_ANGLE = 0.44;

export const flash = {
  /** Light origin (the "hand"), world space. */
  pos: new Vector3(0, 1.5, 0),
  /** Normalized beam direction. */
  dir: new Vector3(0, 0, -1),
  /** Current output 0..1 (on/off, battery stutter, exit death). */
  power: 1,
  /** Seconds of forced stutter requested by other systems (silhouette…). */
  stutter: 0,
};

export const bulbState = {
  level: 1,
  pos: new Vector3(-0.9, 2.2, -0.5),
};

/** Uniform objects shared by every ShaderMaterial of the room (same refs). */
export const sharedUniforms = {
  uFlashPos: { value: flash.pos },
  uFlashDir: { value: flash.dir },
  uFlashCos: { value: Math.cos(FLASH_ANGLE) },
  uFlashInner: { value: Math.cos(FLASH_ANGLE * 0.35) },
  uFlashPower: { value: 1 },
  uBulbPos: { value: bulbState.pos },
  uBulb: { value: 1 },
  uTime: { value: 0 },
};

/**
 * GLSL helper: how much flashlight reaches world point `p` (0..~1).
 * Cone falloff between outer/inner cosines × soft distance attenuation.
 */
export const FLASH_GLSL = /* glsl */ `
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashCos;
uniform float uFlashInner;
uniform float uFlashPower;
uniform vec3 uBulbPos;
uniform float uBulb;
uniform float uTime;

float flashAt(vec3 p) {
  vec3 d = p - uFlashPos;
  float dist = max(length(d), 1e-3);
  float c = dot(d / dist, uFlashDir);
  float cone = smoothstep(uFlashCos, uFlashInner, c);
  float att = 1.0 / (1.0 + dist * dist * 0.12);
  return cone * att * uFlashPower;
}
`;
