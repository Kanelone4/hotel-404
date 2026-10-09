import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { canvasTexture, rng, speckle } from '@/lib/textures/procedural';
import { FONT_MONO } from '@/lib/loaders/fonts';

/** Room 237's wallpaper, torn in strips down to the plaster. */
export const tornWallpaper = () =>
  canvasTexture(
    'r404-torn',
    512,
    (ctx, w) => {
      const r = rng(237);
      ctx.fillStyle = '#4a3b2a';
      ctx.fillRect(0, 0, w, w);
      // Faded damask stripes.
      for (let x = 0; x < w; x += 48) {
        ctx.fillStyle = 'rgba(120,96,60,0.35)';
        ctx.fillRect(x, 0, 6, w);
        for (let y = 24; y < w; y += 64) {
          ctx.strokeStyle = 'rgba(140,110,70,0.35)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x + 24, y, 10, 18, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Tears: jagged polygons revealing plaster, with a dark rim.
      for (let i = 0; i < 9; i++) {
        const cx = r() * w;
        const top = r() * w * 0.6;
        const len = 80 + r() * 260;
        const wid = 18 + r() * 60;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 10; k++)
          pts.push([cx - wid / 2 + (r() - 0.5) * 18, top + (k / 10) * len]);
        for (let k = 10; k >= 0; k--)
          pts.push([cx + (wid / 2) * (1 - k / 14) + (r() - 0.5) * 18, top + (k / 10) * len]);
        ctx.fillStyle = '#1a120b';
        ctx.beginPath();
        pts.forEach(([x, y]) => ctx.lineTo(x + 3, y + 3));
        ctx.fill();
        ctx.fillStyle = '#9d9483';
        ctx.beginPath();
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.fill();
      }
      // Damp stains.
      for (let i = 0; i < 6; i++) {
        const g = ctx.createRadialGradient(r() * w, r() * w, 0, r() * w, r() * w, 60 + r() * 120);
        g.addColorStop(0, 'rgba(20,14,6,0.45)');
        g.addColorStop(1, 'rgba(20,14,6,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, w);
      }
      speckle(ctx, w, w, 0.1, 5);
    },
    { repeat: [2, 1] },
  );

/** Room 101's crayon drawings. 0: the hotel with door 404, 1: mirror without anyone, 2: spirals + "404". */
export const drawing = (variant: number) =>
  canvasTexture(`r404-drawing-${variant}`, 256, (ctx, w) => {
    const r = rng(101 + variant);
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, w, w);
    const crayon = (color: string, width = 5) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    const wobble = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) =>
        i ? ctx.lineTo(x + (r() - 0.5) * 4, y + (r() - 0.5) * 4) : ctx.moveTo(x, y),
      );
      ctx.stroke();
    };
    if (variant === 0) {
      crayon('#2b4c9a');
      wobble([
        [50, 220],
        [50, 70],
        [200, 70],
        [200, 220],
        [50, 220],
      ]);
      crayon('#c0392b', 4);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 3; x++)
          wobble([
            [70 + x * 44, 90 + y * 30],
            [95 + x * 44, 90 + y * 30],
            [95 + x * 44, 108 + y * 30],
            [70 + x * 44, 108 + y * 30],
            [70 + x * 44, 90 + y * 30],
          ]);
      crayon('#111', 6);
      wobble([
        [110, 220],
        [110, 180],
        [140, 180],
        [140, 220],
      ]);
      ctx.fillStyle = '#c0392b';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('404', 98, 40);
      crayon('#e5a100', 4);
      wobble([
        [215, 30],
        [240, 30],
      ]);
    } else if (variant === 1) {
      crayon('#6d4c2f', 6);
      wobble([
        [70, 30],
        [190, 30],
        [190, 230],
        [70, 230],
        [70, 30],
      ]);
      crayon('#9bb7d4', 3);
      for (let i = 0; i < 6; i++)
        wobble([
          [85 + i * 18, 50],
          [100 + i * 18, 210],
        ]);
      ctx.fillStyle = '#222';
      ctx.font = '22px sans-serif';
      ctx.fillText('PERSONNE', 72, 250);
    } else {
      crayon('#7a2b8f', 4);
      ctx.beginPath();
      for (let a = 0; a < 40; a += 0.2)
        ctx.lineTo(128 + Math.cos(a) * a * 2.6, 128 + Math.sin(a) * a * 2.6);
      ctx.stroke();
      ctx.fillStyle = '#c0392b';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText('404', 80, 146);
    }
    speckle(ctx, w, w, 0.05, variant + 3);
  });

/* ── Monologue wall: a live canvas mirroring the DOM text ──────────────── */

let fontReady = false;
let fontLoading = false;
const FAMILY = 'R404Mono';

/** Loads the bundled mono font for canvas use (no network: local asset URL). */
export function ensureCanvasFont() {
  if (fontReady || fontLoading || typeof FontFace === 'undefined') return;
  fontLoading = true;
  const face = new FontFace(FAMILY, `url(${FONT_MONO})`);
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      fontReady = true;
    })
    .catch(() => {
      fontReady = true; // fall back to monospace
    });
}

export interface TextWall {
  texture: Texture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createTextWall(w = 1024, h = 512): TextWall {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, canvas, ctx };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width > max && cur) {
      out.push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Draws the monologue as displayed in the DOM (scrambles included). Lines that
 * leaked off the DOM panel fall down the wall at the same moment.
 * Returns true while something is still animating.
 */
export function drawTextWall(
  wall: TextWall,
  displayed: string[],
  leakedAt: number[],
  time: number,
  corruption: number,
) {
  const { ctx, canvas } = wall;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#050304';
  ctx.fillRect(0, 0, W, H);
  // Header.
  ctx.font = `20px ${FAMILY}, monospace`;
  ctx.fillStyle = '#ff4f5e';
  ctx.fillText('● CANAL 404 · RÉCEPTION', 36, 44);
  ctx.font = `30px ${FAMILY}, monospace`;
  const lh = 38;
  // Show the last lines that fit (newest at the bottom), like a terminal.
  const blocks: { lines: string[]; leak: number; newest: boolean }[] = [];
  displayed.forEach((s, i) =>
    blocks.push({
      lines: wrap(ctx, s ?? '', W - 72),
      leak: leakedAt[i] ?? -1,
      newest: i === displayed.length - 1,
    }),
  );
  let total = 0;
  for (const b of blocks) total += b.lines.length * lh + 10;
  let y = Math.min(90, H - 30 - total + lh);
  let animating = false;
  for (const b of blocks) {
    for (const line of b.lines) {
      let dy = 0;
      let alpha = b.newest ? 1 : 0.72;
      if (b.leak >= 0) {
        const t = time - b.leak;
        dy = t * t * 260;
        alpha *= Math.max(0, 1 - t / 2.2);
        if (alpha > 0) animating = true;
      }
      if (alpha > 0 && y + dy > 60 && y + dy < H + lh) {
        // RGB fringe proportional to corruption.
        const off = 1 + corruption * 4;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#ff2a3c';
        ctx.fillText(line, 36 + off, y + dy);
        ctx.fillStyle = '#29d8ff';
        ctx.fillText(line, 36 - off, y + dy);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f3ead7';
        ctx.fillText(line, 36, y + dy);
        ctx.globalAlpha = 1;
      }
      y += lh;
    }
    y += 10;
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
  wall.texture.needsUpdate = true;
  return animating;
}
