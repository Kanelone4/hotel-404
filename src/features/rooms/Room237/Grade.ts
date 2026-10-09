import { Uniform } from 'three';
import { BlendFunction, Effect } from 'postprocessing';

/**
 * Room 237 color grade (last effect in the chain):
 *  - global gain (bulb-driven flicker, exit blackout),
 *  - desaturation + sickly green shadows,
 *  - heavy film grain that also lives in the blacks (unlike premultiplied Noise).
 */
const fragment = /* glsl */ `
uniform float uGain;
uniform float uDesat;
uniform float uGrain;
uniform float uSeed;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423) + uSeed);
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), uDesat);
  // Shadows lean green-teal, highlights keep the tungsten warmth.
  float shadow = 1.0 - smoothstep(0.0, 0.35, l);
  c *= mix(vec3(1.0), vec3(0.82, 1.0, 0.9), shadow * 0.7);
  // Grain: stronger in the darks, luminance-only.
  float g = hash(uv * 1024.0) - 0.5;
  c += g * uGrain * mix(1.0, 0.45, smoothstep(0.0, 0.5, l));
  c *= uGain;
  outputColor = vec4(max(c, 0.0), inputColor.a);
}
`;

export class GradeEffect extends Effect {
  constructor() {
    super('Room237Grade', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uGain', new Uniform(1)],
        ['uDesat', new Uniform(0.35)],
        ['uGrain', new Uniform(0.06)],
        ['uSeed', new Uniform(0)],
      ]),
    });
  }

  set(gain: number, grain: number, seed: number) {
    this.uniforms.get('uGain')!.value = gain;
    this.uniforms.get('uGrain')!.value = grain;
    this.uniforms.get('uSeed')!.value = seed;
  }
}
