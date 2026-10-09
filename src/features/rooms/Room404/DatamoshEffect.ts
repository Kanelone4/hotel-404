import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Uniform,
  Vector2,
  WebGLRenderTarget,
  type TextureDataType,
  type WebGLRenderer,
} from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

/**
 * Simulated datamosh.
 *
 * Real datamosh = P-frames (motion residuals) applied onto the wrong reference
 * frame after the I-frame was dropped. We fake it with a feedback buffer:
 * each frame, a full-screen pass decides per 24px macroblock whether the block
 * is "refreshed" (takes the current image) or "moshed" (keeps the previous
 * moshed frame, displaced by a per-block motion vector, plus the current
 * frame's motion residual). Moshed blocks accumulate → smears and bleeding.
 *
 * Marked as CONVOLUTION so the R3F EffectComposer gives it its own pass — it
 * reads the whole input buffer in update().
 */
const MOSH_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const MOSH_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tPrev;
uniform float uAmount;
uniform float uTime;
uniform float uRate;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 cur = texture2D(tInput, vUv);
  if (uAmount <= 0.001) { gl_FragColor = cur; return; }
  vec2 blocks = uRes / 24.0;
  vec2 bid = floor(vUv * blocks);
  // "GOP" epoch: block decisions re-roll uRate times per second.
  float slot = floor(uTime * uRate);
  float h = hash(bid + slot * 13.17);
  // Bands of blocks get moshed together (looks like broken slices).
  float band = hash(vec2(bid.y * 0.37, slot));
  float moshed = step(1.0 - uAmount * 0.6, max(h * 0.85, band * step(0.7, band)));
  // Per-block motion vector (in uv), mostly horizontal + occasional vertical drip.
  vec2 mv = (vec2(hash(bid + 3.1 + slot), hash(bid + 7.7 + slot)) - 0.5);
  mv *= vec2(2.0, 0.6 + 2.0 * step(0.85, hash(bid.xx + slot))) / blocks * (0.35 + uAmount * 1.4);
  vec4 prev = texture2D(tPrev, vUv - mv);
  // Residual of the current frame applied to the stale reference = bleeding.
  vec3 residual = cur.rgb - texture2D(tInput, vUv - mv).rgb;
  vec3 bleed = prev.rgb + residual * 0.8;
  vec3 col = mix(cur.rgb, bleed, moshed);
  gl_FragColor = vec4(clamp(col, 0.0, 8.0), 1.0);
}
`;

const MAIN_FRAG = /* glsl */ `
uniform sampler2D tMosh;
uniform float uAmount;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = uAmount <= 0.001 ? inputColor : vec4(texture2D(tMosh, uv).rgb, inputColor.a);
}
`;

export class DatamoshEffect extends Effect {
  /** 0 = off, 1 = heavy. */
  amount = 0;
  /** Block re-roll rate (Hz). Lower = slower, calmer (reduced motion). */
  rate = 8;
  private time = 0;
  private targets: [WebGLRenderTarget, WebGLRenderTarget];
  private mat: ShaderMaterial;
  private scene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private scale: number;

  constructor({ resolutionScale = 1 }: { resolutionScale?: number } = {}) {
    super('DatamoshEffect', MAIN_FRAG, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['tMosh', new Uniform(null)],
        ['uAmount', new Uniform(0)],
      ]),
    });
    this.scale = resolutionScale;
    const mk = () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
      });
    this.targets = [mk(), mk()];
    this.mat = new ShaderMaterial({
      vertexShader: MOSH_VERT,
      fragmentShader: MOSH_FRAG,
      uniforms: {
        tInput: { value: null },
        tPrev: { value: null },
        uAmount: { value: 0 },
        uTime: { value: 0 },
        uRate: { value: 8 },
        uRes: { value: new Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  override initialize(renderer: WebGLRenderer, alpha: boolean, frameBufferType: number) {
    super.initialize(renderer, alpha, frameBufferType);
    for (const t of this.targets) t.texture.type = frameBufferType as TextureDataType;
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, deltaTime = 0) {
    this.time += deltaTime;
    const amount = this.amount;
    this.uniforms.get('uAmount')!.value = amount;
    if (amount <= 0.001) return;
    const [read, write] = this.targets;
    const u = this.mat.uniforms;
    u.tInput.value = inputBuffer.texture;
    u.tPrev.value = read.texture;
    u.uAmount.value = amount;
    u.uTime.value = this.time;
    u.uRate.value = this.rate;
    u.uRes.value.set(write.width, write.height);
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(this.scene, this.cam);
    renderer.setRenderTarget(prevTarget);
    this.targets = [write, read];
    this.uniforms.get('tMosh')!.value = write.texture;
  }

  override setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width * this.scale));
    const h = Math.max(1, Math.round(height * this.scale));
    for (const t of this.targets) t.setSize(w, h);
  }

  override dispose() {
    super.dispose();
    for (const t of this.targets) t.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
