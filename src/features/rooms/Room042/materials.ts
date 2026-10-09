import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  type MeshStandardMaterialParameters,
} from 'three';
import { shared } from './state';

/* ──────────────────────────────────────────────────────────────────────────
 * Caustics
 * A classic iterated "tileable water caustic" (after joltz0r / Dave Hoskins),
 * evaluated in WORLD space and added to the direct diffuse term of a
 * MeshStandardMaterial via onBeforeCompile — so caustics are lit by the
 * surface albedo, receive fog and tone mapping like the rest of the scene.
 * Floors use world XZ; walls use (x+z, y) so the pattern crawls up them.
 * ────────────────────────────────────────────────────────────────────────── */
export const CAUSTIC_GLSL = /* glsl */ `
float causticField(vec2 uv, float time) {
  // 2π-periodic, so mod() keeps it tileable and avoids float precision loss.
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}
`;

export function causticMaterial(params: MeshStandardMaterialParameters, scale = 0.45, strength = 1) {
  const m = new MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uCaustic = shared.uCaustic;
    shader.uniforms.uCColor = shared.uCColor;
    shader.uniforms.uCScale = { value: scale };
    shader.uniforms.uCLocal = { value: strength };
    shader.vertexShader =
      'varying vec3 vCWorld;\nvarying vec3 vCNormal;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vCNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader =
      `varying vec3 vCWorld;
      varying vec3 vCNormal;
      uniform float uTime;
      uniform float uCaustic;
      uniform vec3 uCColor;
      uniform float uCScale;
      uniform float uCLocal;
      ${CAUSTIC_GLSL}\n` +
      shader.fragmentShader.replace(
        '#include <aomap_fragment>',
        `{
          vec3 cn = normalize(vCNormal);
          float up = abs(cn.y);
          vec2 cuv = mix(vec2(vCWorld.x + vCWorld.z, vCWorld.y * 1.3), vCWorld.xz, up);
          // Two drifting layers multiplied = sharper, less repetitive network.
          float ca = causticField(cuv * uCScale, uTime * 0.55);
          ca = ca * 0.65 + ca * causticField(cuv * uCScale * 0.63 + 0.37, uTime * 0.41) * 0.9;
          // Floors get the full light, walls less, undersides almost none.
          float facing = cn.y > 0.5 ? 1.0 : (cn.y < -0.5 ? 0.12 : 0.55);
          reflectedLight.directDiffuse += diffuseColor.rgb * uCColor * ca * uCaustic * uCLocal * facing;
        }
        #include <aomap_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'r042-caustic';
  return m;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sway — for curtains, peeling wallpaper strips and sheets.
 * Hinged at the plane's top edge (local +Y = height/2): displacement grows
 * toward the free edge. `curl` bends the free edge away from the wall.
 * Motion fades with uDrain (water leaves → cloth falls still).
 * ────────────────────────────────────────────────────────────────────────── */
export function swayMaterial(
  params: MeshStandardMaterialParameters,
  opts: { height: number; amp?: number; curl?: number; phase?: number; speed?: number },
) {
  const m = new MeshStandardMaterial({ side: DoubleSide, ...params });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uDrain = shared.uDrain;
    shader.uniforms.uMotion = shared.uMotion;
    shader.uniforms.uSH = { value: opts.height };
    shader.uniforms.uSAmp = { value: opts.amp ?? 0.12 };
    shader.uniforms.uSCurl = { value: opts.curl ?? 0 };
    shader.uniforms.uSPhase = { value: opts.phase ?? 0 };
    shader.uniforms.uSSpeed = { value: opts.speed ?? 1 };
    shader.vertexShader =
      `uniform float uTime; uniform float uDrain; uniform float uMotion;
      uniform float uSH; uniform float uSAmp; uniform float uSCurl; uniform float uSPhase; uniform float uSSpeed;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float k = clamp((uSH * 0.5 - position.y) / uSH, 0.0, 1.0); // 0 at hinge, 1 at free edge
          float t = uTime * uSSpeed + uSPhase;
          float live = (1.0 - uDrain) * uMotion;
          float wave = sin(t * 0.9 + position.x * 3.0) * 0.7 + sin(t * 1.7 + position.y * 2.3 + position.x * 5.0) * 0.3;
          transformed.z += (wave * uSAmp * live + uSCurl * (1.0 - uDrain * 0.7)) * k * k;
          transformed.x += sin(t * 0.6) * 0.04 * k * live;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'r042-sway';
  return m;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Fake god rays: open cone, additive. Brightness = view-facing term (soft
 * edges), falloff away from the source (uv.y = 1 at the narrow top),
 * and slow world-space streaks so the shaft "breathes".
 * ────────────────────────────────────────────────────────────────────────── */
export function shaftMaterial(color: string, opacity: number) {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDrain: shared.uDrain,
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vH;
      void main() {
        vH = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uDrain; uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vH;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 2.2);
        float fall = pow(vH, 1.6) * smoothstep(0.0, 0.12, vH);
        float streak = 0.55 + 0.45 * sin(vW.x * 6.0 + vW.z * 4.0 + uTime * 0.6) * sin(vW.x * 2.7 - vW.z * 3.9 - uTime * 0.35);
        float a = edge * fall * streak * uOpacity * (1.0 - uDrain);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Water surface — seen from below it is a bright, wobbling mirror
 * (total internal reflection); from above, a dark translucent sheet.
 * ────────────────────────────────────────────────────────────────────────── */
export function surfaceMaterial(opacity = 1) {
  return new ShaderMaterial({
    uniforms: { uTime: shared.uTime, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpacity;
      varying vec3 vW;
      void main() {
        float r = sin(vW.x * 9.0 + uTime * 1.3) * sin(vW.z * 8.0 - uTime * 1.1)
                + 0.5 * sin((vW.x + vW.z) * 13.0 + uTime * 2.0)
                + 0.25 * sin((vW.x - vW.z) * 21.0 - uTime * 2.7);
        vec3 col; float a;
        if (gl_FrontFacing) {
          col = vec3(0.04, 0.2, 0.24) + r * 0.03;
          a = 0.6;
        } else {
          col = mix(vec3(0.18, 0.5, 0.6), vec3(0.85, 1.0, 1.0), smoothstep(0.1, 1.4, r));
          a = 0.82;
        }
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}
