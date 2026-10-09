import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

/**
 * One full-screen pass that does everything "lens" in room 013:
 *  - a slow space wobble (the room never quite holds still),
 *  - a horizontal *frame flip* (uFlip pulse 0→1→0: a ghost of the mirrored
 *    frame bleeds in, then for a few frames the image is truly mirrored),
 *  - strong radial chromatic aberration.
 * It samples the input buffer at arbitrary UVs, so it is a CONVOLUTION effect
 * (postprocessing then gives it its own EffectPass — no merge conflicts).
 */
const fragment = /* glsl */ `
uniform float uTime;
uniform float uAberration; // radial RGB split strength (UV units)
uniform float uWobble;     // 0..1 space distortion amount
uniform float uFlip;       // 0..1 pulse; > 0.5 = frame mirrored horizontally

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);

  // Space distortion: two crossed slow sines, stronger toward the edges.
  vec2 p = uv + vec2(
    sin(uv.y * 6.0 + uTime * 0.8),
    cos(uv.x * 5.0 - uTime * 0.6)
  ) * 0.0045 * uWobble * (0.3 + r2 * 2.5);

  // Horizontal frame flip (hard switch in the middle of the pulse).
  vec2 q = mix(p, vec2(1.0 - p.x, p.y), step(0.5, uFlip));

  // Radial chromatic aberration: R pushed out, B pulled in.
  vec2 dir = q - 0.5;
  float k = uAberration * (0.35 + length(dir) * 1.8);
  vec3 col;
  col.r = texture2D(inputBuffer, q + dir * k).r;
  col.g = texture2D(inputBuffer, q).g;
  col.b = texture2D(inputBuffer, q - dir * k).b;

  // Ghost of the mirrored frame on the pulse edges (peaks at uFlip = 0.5).
  vec3 ghost = texture2D(inputBuffer, vec2(1.0 - q.x, q.y)).rgb;
  col = mix(col, ghost, uFlip * (1.0 - uFlip) * 1.6);

  outputColor = vec4(col, inputColor.a);
}
`;

export class InvertedLensEffect extends Effect {
  constructor() {
    super('InvertedLensEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uAberration', new Uniform(0.006)],
        ['uWobble', new Uniform(1)],
        ['uFlip', new Uniform(0)],
      ]),
    });
  }

  set(name: 'uTime' | 'uAberration' | 'uWobble' | 'uFlip', v: number) {
    const u = this.uniforms.get(name);
    if (u) u.value = v;
  }
}
