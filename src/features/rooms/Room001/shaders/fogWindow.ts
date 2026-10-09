import { Color, ShaderMaterial } from 'three';

/**
 * The view through the window: an endless wall of night fog.
 *
 * - Three fbm layers at different scales/speeds give parallax depth.
 * - A faint sodium street light far away, its halo smeared by the fog.
 * - `uTime` is NOT wall-clock time: the room advances it with the player's
 *   speed, so the fog only drifts while you move ("il vous regarde bouger").
 * - Output is linear (no tone mapping include) — kept dim on purpose so the
 *   window reads as a cold light source next to the warm lamp.
 */
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uFade;     // 1 = visible, 0 = black (exit)
  uniform float uDark;     // 0 lamp on … 1 lamp off (eyes adapt: fog reads brighter)
  uniform vec3 uFogColor;
  uniform vec3 uDeepColor;
  uniform vec3 uLightColor;
  varying vec2 vUv;

  // Hash-based value noise (cheap, no textures).
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // 5-octave fractal Brownian motion with a rotation between octaves.
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * vec2(2.2, 1.8);
    float t = uTime;

    // Domain-warped layers: far (slow), mid, near (fast, thicker).
    float far  = fbm(p * 0.9 + vec2(t * 0.02, 0.0));
    float mid  = fbm(p * 1.6 + vec2(t * 0.05, t * 0.01) + far);
    float near = fbm(p * 2.8 + vec2(t * 0.11, -t * 0.02) + mid * 0.6);
    float density = clamp(far * 0.35 + mid * 0.4 + near * 0.45, 0.0, 1.0);

    // Vertical gradient: denser toward the ground, deep blue above.
    float ground = smoothstep(0.75, 0.0, uv.y);
    vec3 col = mix(uDeepColor, uFogColor, density * 0.75 + ground * 0.35);

    // Distant light, low and to the left: tiny core + wide fog-scattered halo.
    vec2 lp = vec2(0.28, 0.33);
    float d = length((uv - lp) * vec2(1.6, 1.0));
    float pulse = 0.85 + 0.15 * sin(t * 0.7);
    float core = smoothstep(0.012, 0.0, d) * (1.0 - near * 0.6);
    float halo = exp(-d * 9.0) * 0.55 * (0.6 + density * 0.6);
    col += uLightColor * (core * 1.6 + halo) * pulse;

    // Eyes adapt in the dark: the outside gets a touch brighter.
    col *= mix(0.75, 1.25, uDark);
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

export function createFogWindowMaterial() {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uDark: { value: 0 },
      uFogColor: { value: new Color('#55697f') },
      uDeepColor: { value: new Color('#0a1120') },
      uLightColor: { value: new Color('#ff9c45') },
    },
    fog: false,
    toneMapped: false,
  });
}
