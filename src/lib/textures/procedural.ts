import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Canvas-generated textures — no image downloads. Cached by key so repeated
 * calls across scenes reuse the same GPU texture.
 */
const cache = new Map<string, Texture>();

export interface TexOpts {
  repeat?: [number, number];
  /** Color textures are sRGB; data maps (roughness, bump) are linear. */
  color?: boolean;
  anisotropy?: number;
}

export function canvasTexture(
  key: string,
  size: number | [number, number],
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: TexOpts = {},
): Texture {
  const cacheKey = `${key}|${opts.repeat?.join('x') ?? ''}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const [w, h] = typeof size === 'number' ? [size, size] : size;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  if (opts.repeat) tex.repeat.set(...opts.repeat);
  if (opts.color !== false) tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  cache.set(cacheKey, tex);
  return tex;
}

/** Deterministic PRNG so textures look the same on every visit. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Speckle noise overlay used by most generators. */
export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.08, seed = 7) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 255 * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** 70s hotel carpet: interlocking amber / brown / sage hexagons. */
export const carpet = (repeat: [number, number] = [6, 8], palette = ['#3a2417', '#7a4a1e', '#c58a35', '#4d5f56']) =>
  canvasTexture(`carpet-${palette.join()}`, 256, (ctx, w) => {
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, w, w);
    const s = w / 4;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const cx = x * s + s / 2;
        const cy = y * s + s / 2;
        ctx.strokeStyle = palette[1];
        ctx.lineWidth = s * 0.18;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.lineTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = (x + y) % 2 ? palette[2] : palette[3];
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    speckle(ctx, w, w, 0.12, 3);
  }, { repeat });

/** Damask-ish wallpaper with vertical stripes. */
export const wallpaper = (repeat: [number, number] = [4, 2], base = '#2f3d36', ink = '#3e5047', seed = 11) =>
  canvasTexture(`wallpaper-${base}-${ink}-${seed}`, 256, (ctx, w) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = ink;
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 3, w);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const cx = 64 + x * 128 + (y % 2) * 64;
        const cy = 64 + y * 128;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 22, 38, 0, 0, Math.PI * 2);
        ctx.moveTo(cx, cy - 38);
        ctx.lineTo(cx, cy + 38);
        ctx.moveTo(cx - 22, cy);
        ctx.quadraticCurveTo(cx, cy - 18, cx + 22, cy);
        ctx.stroke();
      }
    speckle(ctx, w, w, 0.06, seed);
  }, { repeat });

/** Wood planks / veneer. */
export const wood = (repeat: [number, number] = [1, 1], tone = '#5a3820', seed = 5) =>
  canvasTexture(`wood-${tone}-${seed}`, 256, (ctx, w) => {
    const r = rng(seed);
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '0,0,0' : '255,220,170'},${0.04 + r() * 0.08})`;
      ctx.lineWidth = 1 + r() * 2;
      const y = r() * w;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 3 * r());
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 2, w);
    speckle(ctx, w, w, 0.05, seed);
  }, { repeat });

/** Square ceramic tiles. */
export const tiles = (repeat: [number, number] = [4, 4], tile = '#cfd6cf', grout = '#59625c', n = 4) =>
  canvasTexture(`tiles-${tile}-${grout}-${n}`, 256, (ctx, w) => {
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, w, w);
    const s = w / n;
    const r = rng(9);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = tile;
        ctx.globalAlpha = 0.85 + r() * 0.15;
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
    ctx.globalAlpha = 1;
    speckle(ctx, w, w, 0.05, 2);
  }, { repeat });

/** Grayscale value noise — use as roughness / bump / alpha map. */
export const noiseMap = (repeat: [number, number] = [1, 1], scale = 32, seed = 21) =>
  canvasTexture(`noise-${scale}-${seed}`, 256, (ctx, w) => {
    const r = rng(seed);
    const g = Math.max(2, Math.floor(w / scale));
    const grid = Array.from({ length: (g + 1) * (g + 1) }, () => r());
    const img = ctx.createImageData(w, w);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * g;
        const gy = (y / w) * g;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = gx - x0;
        const fy = gy - y0;
        const at = (i: number, j: number) => grid[((j % g) * (g + 1) + (i % g)) | 0];
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const v =
          at(x0, y0) * (1 - sx) * (1 - sy) +
          at(x0 + 1, y0) * sx * (1 - sy) +
          at(x0, y0 + 1) * (1 - sx) * sy +
          at(x0 + 1, y0 + 1) * sx * sy;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }, { repeat, color: false });

/** Radial glow sprite (for lamps, halos, fake volumetrics). */
export const glow = (color = '#ffcf7a') =>
  canvasTexture(`glow-${color}`, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color + 'aa');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
