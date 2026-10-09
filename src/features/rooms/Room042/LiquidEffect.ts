import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * Underwater screen pass.
 *  - mainUv: animated sinusoidal UV warp, stronger toward the edges (refraction
 *    through a moving water body). Non-convolution, so it merges into the same
 *    EffectPass as Bloom/Vignette and costs one extra texture fetch at most.
 *  - mainImage: wavelength absorption tint (reds die first) + oxygen-loss
 *    tunnel vision (`uDark`).
 */
const fragment = /* glsl */ `
uniform float uTime;
uniform float uWarp;
uniform float uDark;
uniform float uTint;

void mainUv(inout vec2 uv) {
  vec2 p = uv * vec2(aspect, 1.0);
  float edge = smoothstep(0.15, 0.8, length(uv - 0.5));
  vec2 w = vec2(
    sin(p.y * 9.0 + uTime * 1.1) + 0.5 * sin(p.y * 23.0 - uTime * 1.7 + p.x * 3.0),
    sin(p.x * 8.0 - uTime * 0.9) + 0.5 * sin(p.x * 19.0 + uTime * 1.3 + p.y * 5.0)
  );
  uv += w * uWarp * (0.35 + edge);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // Absorption: water swallows red, keeps green/blue.
  c = mix(c, c * vec3(0.7, 0.96, 1.06), uTint);
  // Tunnel vision when oxygen runs low.
  float d = length((uv - 0.5) * vec2(aspect, 1.0));
  float vis = 1.0 - uDark * smoothstep(0.7 - 0.55 * uDark, 1.05 - 0.45 * uDark, d);
  outputColor = vec4(c * vis, inputColor.a);
}
`;

export class LiquidEffect extends Effect {
  constructor() {
    super('LiquidEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uWarp', new Uniform(0.004)],
        ['uDark', new Uniform(0)],
        ['uTint', new Uniform(1)],
      ]),
    });
  }

  set warp(v: number) {
    this.uniforms.get('uWarp')!.value = v;
  }
  set dark(v: number) {
    this.uniforms.get('uDark')!.value = v;
  }
  set tint(v: number) {
    this.uniforms.get('uTint')!.value = v;
  }

  override update(_renderer: WebGLRenderer, _input: WebGLRenderTarget, deltaTime = 0) {
    this.uniforms.get('uTime')!.value += deltaTime;
  }
}
