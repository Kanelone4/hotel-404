import { MeshStandardMaterial, type Texture } from 'three';
import { canvasTexture, rng, speckle } from '@/lib/textures/procedural';

/** Uniforms shared by every breathing surface (updated once per frame by the room). */
export const breathUniforms = {
  uTime: { value: 0 },
  uAmp: { value: 0.06 },
};

/**
 * Standard material whose vertices swell *outward* (away from the room) along
 * their normal, like a lung. Displacement is zero on the plane's borders
 * (sin(πu)·sin(πv)) so wall seams and corners never open.
 * Needs a subdivided plane (≥ 24×12 segments).
 */
export function breathingMaterial(map: Texture, opts: { roughness?: number; color?: string } = {}) {
  const m = new MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.85, color: opts.color ?? '#ffffff' });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = breathUniforms.uTime;
    shader.uniforms.uAmp = breathUniforms.uAmp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmp;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // Envelope: 0 on the edges, 1 in the middle of the wall.
        float env = sin(uv.x * PI) * sin(uv.y * PI);
        // Slow breath (in/out ~7 s) + a travelling shiver that runs along the wall.
        float breath = 0.5 + 0.5 * sin(uTime * 0.9 + position.x * 0.35);
        float shiver = 0.18 * sin(uTime * 2.3 - position.y * 3.0 + position.x * 1.7);
        // The plane's +Z normal faces the room: subtract to bulge outward only.
        transformed -= objectNormal * max(breath + shiver, 0.0) * uAmp * env;`,
      );
  };
  m.customProgramCacheKey = () => 'room013-breathing';
  return m;
}

/** Cream plaster with hairline cracks — the ceiling, which is now the floor. */
export const plaster = () =>
  canvasTexture(
    'r013-plaster',
    512,
    (ctx, w) => {
      ctx.fillStyle = '#cbbfa8';
      ctx.fillRect(0, 0, w, w);
      const r = rng(13);
      // Soft blotches (old paint).
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? '90,70,50' : '255,245,220'},${0.03 + r() * 0.04})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * w, 20 + r() * 70, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hairline cracks.
      ctx.strokeStyle = 'rgba(60,45,35,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        let x = r() * w;
        let y = r() * w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 14; k++) {
          x += (r() - 0.5) * 40;
          y += (r() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      speckle(ctx, w, w, 0.06, 4);
    },
    { repeat: [3, 3] },
  );

/** Night sky seen through the window — stars, a crescent, city glow at the bottom. */
export const nightSky = () =>
  canvasTexture('r013-sky', [256, 256], (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#02030a');
    g.addColorStop(0.7, '#0b1530');
    g.addColorStop(1, '#3a2a40');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(77);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`;
      const s = r() < 0.1 ? 2 : 1;
      ctx.fillRect(r() * w, r() * h * 0.75, s, s);
    }
    // Crescent moon.
    ctx.fillStyle = '#f6efd0';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.22, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#04060f';
    ctx.beginPath();
    ctx.arc(w * 0.72 + 8, h * 0.22 - 5, 16, 0, Math.PI * 2);
    ctx.fill();
    // City lights silhouette.
    for (let x = 0; x < w; x += 6 + r() * 10) {
      const bh = 10 + r() * 40;
      ctx.fillStyle = '#05050a';
      ctx.fillRect(x, h - bh, 8, bh);
      ctx.fillStyle = 'rgba(255,200,120,0.8)';
      if (r() > 0.4) ctx.fillRect(x + 2, h - bh + 4 + r() * 8, 2, 2);
    }
  });

/** A small seascape painting (sky on top — which the player sees at the bottom). */
export const seascape = () =>
  canvasTexture('r013-painting', [256, 160], (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#6d8fb0');
    sky.addColorStop(1, '#e8c79a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.55);
    ctx.fillStyle = '#f4d48a';
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.42, 14, 0, Math.PI * 2);
    ctx.fill();
    const sea = ctx.createLinearGradient(0, h * 0.55, 0, h);
    sea.addColorStop(0, '#2d5568');
    sea.addColorStop(1, '#0e2330');
    ctx.fillStyle = sea;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = 'rgba(255,240,210,0.35)';
    const r = rng(5);
    for (let i = 0; i < 40; i++) {
      const y = h * 0.58 + r() * h * 0.4;
      const x = r() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + r() * 14, y);
      ctx.stroke();
    }
    // A sailboat, tiny.
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath();
    ctx.moveTo(w * 0.66, h * 0.55);
    ctx.lineTo(w * 0.66, h * 0.36);
    ctx.lineTo(w * 0.72, h * 0.55);
    ctx.fill();
    speckle(ctx, w, h, 0.08, 9);
  });
