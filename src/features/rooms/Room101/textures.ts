import { canvasTexture, rng, speckle } from '@/lib/textures/procedural';
import type { Texture } from 'three';

/**
 * Canvas textures for the nursery: wax-crayon children's drawings, pastel
 * wallpaper (calm + "changed" variant), toy blocks, rug, beach ball.
 * Every key is prefixed `r101-` so the global cache never collides.
 */

type Ctx = CanvasRenderingContext2D;
type R = () => number;
type Pt = [number, number];

const KID_FONT = '"Comic Sans MS", "Chalkboard SE", "Marker Felt", "Segoe Print", cursive';

// ─── Crayon primitives ────────────────────────────────────────────────────

/** Wobbly wax line: several jittered low-alpha passes. */
function crayon(ctx: Ctx, pts: Pt[], color: string, width: number, r: R, passes = 3) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = 0.5 + r() * 0.25;
    ctx.lineWidth = width * (0.6 + r() * 0.5);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (r() - 0.5) * width * 0.9;
      const jy = y + (r() - 0.5) * width * 0.9;
      if (i) ctx.lineTo(jx, jy);
      else ctx.moveTo(jx, jy);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Points along a wobbly ellipse. */
function ell(cx: number, cy: number, rx: number, ry: number, r: R, n = 22, wob = 0.06): Pt[] {
  const pts: Pt[] = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i <= n + 1; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * wob;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Zig-zag scribble fill clipped to a path (how kids color in). */
function scribble(ctx: Ctx, path: Pt[], color: string, width: number, r: R, density = 1) {
  ctx.save();
  ctx.beginPath();
  path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of path) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const step = (width * 0.9) / density;
  const pts: Pt[] = [];
  let up = true;
  for (let x = x0 - 20; x < x1 + 20; x += step * (0.7 + r() * 0.6)) {
    pts.push([x + (y1 - y0) * 0.25, up ? y0 - 10 : y1 + 10]);
    up = !up;
  }
  crayon(ctx, pts, color, width, r, 2);
  ctx.restore();
}

/** Child handwriting: per-letter size/rotation wobble, some letters mirrored. */
function kidText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, r: R, spacing = 0.78, mirror = '') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += size * 0.5;
      continue;
    }
    const s = size * (0.85 + r() * 0.35);
    ctx.font = `bold ${Math.round(s)}px ${KID_FONT}`;
    for (let p = 0; p < 4; p++) {
      ctx.save();
      ctx.globalAlpha = 0.45 + r() * 0.3;
      ctx.translate(cx + (r() - 0.5) * 3, y + (r() - 0.5) * size * 0.18);
      ctx.rotate((r() - 0.5) * 0.35);
      if (mirror.includes(ch)) ctx.scale(-1, 1);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    cx += size * spacing * (0.9 + r() * 0.25);
  }
  ctx.globalAlpha = 1;
}

/** Plain text width estimate for centering kid text. */
function kidWidth(text: string, size: number, spacing = 0.78) {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? size * 0.5 : size * spacing * 1.02;
  return w;
}

function kidTextCentered(ctx: Ctx, text: string, cx: number, y: number, size: number, color: string, r: R, mirror = '') {
  kidText(ctx, text, cx - kidWidth(text, size) / 2 + size * 0.4, y, size, color, r, 0.78, mirror);
}

/** Cheap paper sheet: off-white, fibers, slight vignette, folded crease. */
function paper(ctx: Ctx, w: number, h: number, seed: number, tint = '#f3ecd9') {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  ctx.strokeStyle = 'rgba(120,100,70,0.06)';
  for (let i = 0; i < 160; i++) {
    ctx.lineWidth = 0.5 + r();
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(110,80,40,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws `art` on a transparent layer, then pits it with "paper tooth"
 * (destination-out speckles) so it reads as wax, and composites onto `ctx`.
 */
function waxLayer(ctx: Ctx, w: number, h: number, seed: number, art: (c: Ctx, r: R) => void) {
  const layer = document.createElement('canvas');
  layer.width = w;
  layer.height = h;
  const c = layer.getContext('2d')!;
  art(c, rng(seed));
  c.globalCompositeOperation = 'destination-out';
  const r = rng(seed + 99);
  const n = (w * h) / 60;
  for (let i = 0; i < n; i++) {
    c.globalAlpha = 0.25 + r() * 0.6;
    c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 1.5);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, 0, 0);
}

function stickKid(c: Ctx, r: R, x: number, y: number, s: number, color: string, hair: string) {
  crayon(c, ell(x, y, 34 * s, 36 * s, r), color, 7 * s, r);
  scribble(c, ell(x, y - 26 * s, 36 * s, 16 * s, r), hair, 7 * s, r);
  crayon(c, [[x - 12 * s, y - 4 * s], [x - 11 * s, y - 2 * s]], '#222', 8 * s, r);
  crayon(c, [[x + 12 * s, y - 4 * s], [x + 13 * s, y - 2 * s]], '#222', 8 * s, r);
  crayon(c, [[x - 14 * s, y + 12 * s], [x, y + 20 * s], [x + 14 * s, y + 12 * s]], '#c0392b', 5 * s, r);
  // dress triangle
  const body: Pt[] = [[x, y + 36 * s], [x - 40 * s, y + 140 * s], [x + 40 * s, y + 140 * s]];
  scribble(c, body, color, 8 * s, r);
  crayon(c, [...body, body[0]], color, 6 * s, r);
  crayon(c, [[x - 15 * s, y + 140 * s], [x - 20 * s, y + 200 * s]], '#333', 6 * s, r);
  crayon(c, [[x + 15 * s, y + 140 * s], [x + 20 * s, y + 200 * s]], '#333', 6 * s, r);
}

// ─── The puzzle: one wide drawing, cut in three ───────────────────────────

const PW = 512;

/** Full 1536×512 composition: the child, a red thread, the door 404, the tall man. */
function puzzleArt(c: Ctx, r: R) {
  // Ground line that runs across all three sheets (alignment cue).
  const ground: Pt[] = [];
  for (let x = 10; x <= PW * 3 - 10; x += 40) ground.push([x, 380 + Math.sin(x * 0.01) * 8]);
  crayon(c, ground, '#6b4a2b', 9, r);
  // Purple sky band scribbled on top across all three.
  scribble(c, [[0, 0], [PW * 3, 0], [PW * 3, 46], [0, 62]], '#5b4fa3', 10, r, 0.6);
  // Stars in the band
  for (const sx of [70, 300, 610, 980, 1180, 1420]) kidText(c, '*', sx, 40, 46, '#f5c542', r);

  // LEFT — the child holding the teddy.
  stickKid(c, r, 220, 150, 1, '#e48aa8', '#e2b23c');
  crayon(c, ell(150, 300, 26, 30, r), '#8a5a33', 7, r);
  scribble(c, ell(150, 300, 26, 30, r), '#a8743f', 7, r);
  crayon(c, ell(132, 268, 9, 9, r), '#8a5a33', 5, r);
  crayon(c, ell(168, 268, 9, 9, r), '#8a5a33', 5, r);
  // Red thread from the child's hand into the next sheet, to the door knob.
  const thread: Pt[] = [];
  for (let x = 262; x <= 860; x += 22) thread.push([x, 230 + Math.sin(x * 0.03) * 10 + (x - 262) * 0.06]);
  crayon(c, thread, '#d1262f', 6, r);

  // MIDDLE — the door 404.
  const door: Pt[] = [[640, 110], [890, 104], [896, 382], [634, 384]];
  scribble(c, door, '#2a2236', 12, r, 1.3);
  crayon(c, [...door, door[0]], '#111', 9, r);
  crayon(c, ell(862, 262, 12, 12, r), '#e8c13a', 7, r);
  // Door plate
  scribble(c, [[690, 140], [840, 138], [842, 210], [688, 212]], '#f2efe6', 10, r, 1.4);
  kidTextCentered(c, '404', 765, 176, 70, '#d1262f', r);
  // Light leaking under the door
  crayon(c, [[640, 378], [890, 376]], '#f5c542', 8, r);

  // RIGHT — the tall man with no face, and the moon.
  const man: Pt[] = [[1240, 120], [1290, 116], [1310, 370], [1222, 372]];
  scribble(c, man, '#141218', 12, r, 1.4);
  crayon(c, ell(1265, 94, 34, 40, r), '#141218', 10, r);
  scribble(c, ell(1265, 94, 34, 40, r), '#141218', 10, r);
  crayon(c, [[1252, 92], [1253, 94]], '#f4f1e8', 7, r);
  crayon(c, [[1278, 92], [1279, 94]], '#f4f1e8', 7, r);
  crayon(c, [[1222, 160], [1150, 260], [1140, 300]], '#141218', 7, r);
  crayon(c, [[1310, 160], [1360, 250]], '#141218', 7, r);
  crayon(c, ell(1420, 130, 40, 40, r), '#f5c542', 8, r);
  scribble(c, ell(1420, 130, 40, 40, r), '#f5c542', 8, r);

  // The message, one word per sheet.
  kidTextCentered(c, 'LA CHAMBRE', 256, 452, 58, '#2a4d8f', r);
  kidTextCentered(c, '404', 768, 452, 74, '#d1262f', r);
  kidTextCentered(c, 'EXISTE', 1280, 452, 62, '#2a4d8f', r, 'S');
}

/** One sheet of the 3-part puzzle drawing. */
export const puzzleSheet = (i: number): Texture =>
  canvasTexture(`r101-puzzle-${i}`, PW, (ctx, w, h) => {
    paper(ctx, w, h, 31 + i);
    waxLayer(ctx, w, h, 404, (c, r) => {
      c.translate(-PW * i, 0);
      puzzleArt(c, r);
    });
    // Pin hole + tape shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(w / 2, 14, 4, 0, Math.PI * 2);
    ctx.fill();
  });

// ─── Decorative drawings ──────────────────────────────────────────────────

export type DecoKind = 'family' | 'wardrobe' | 'hotel' | 'rainbow';

const DECO: Record<DecoKind, (c: Ctx, r: R, w: number, h: number) => void> = {
  family: (c, r, w, h) => {
    // House + sun + family: one figure angrily scribbled out.
    crayon(c, ell(w * 0.85, h * 0.15, 40, 40, r), '#f5b700', 9, r);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      crayon(c, [[w * 0.85 + Math.cos(a) * 52, h * 0.15 + Math.sin(a) * 52], [w * 0.85 + Math.cos(a) * 80, h * 0.15 + Math.sin(a) * 80]], '#f5b700', 6, r);
    }
    crayon(c, [[0, h * 0.85], [w, h * 0.83]], '#3d9a4a', 14, r);
    stickKid(c, r, w * 0.2, h * 0.4, 0.75, '#3b6fc4', '#5a3a1e');
    stickKid(c, r, w * 0.43, h * 0.4, 0.8, '#d0507a', '#e2b23c');
    stickKid(c, r, w * 0.64, h * 0.52, 0.55, '#e48aa8', '#e2b23c');
    stickKid(c, r, w * 0.84, h * 0.47, 0.65, '#888', '#333');
    scribble(c, [[w * 0.74, h * 0.3], [w * 0.95, h * 0.3], [w * 0.95, h * 0.82], [w * 0.74, h * 0.82]], '#111', 12, r, 1.6);
    kidText(c, 'PAPA MAMAN MOI', w * 0.06, h * 0.93, 30, '#2a4d8f', r, 0.7);
  },
  wardrobe: (c, r, w, h) => {
    const box: Pt[] = [[w * 0.25, h * 0.12], [w * 0.75, h * 0.1], [w * 0.77, h * 0.82], [w * 0.23, h * 0.84]];
    scribble(c, box, '#9c6b3e', 10, r);
    crayon(c, [...box, box[0]], '#5a3a1e', 8, r);
    scribble(c, [[w * 0.49, h * 0.12], [w * 0.55, h * 0.12], [w * 0.56, h * 0.82], [w * 0.5, h * 0.82]], '#0a0a0a', 8, r, 1.6);
    crayon(c, [[w * 0.515, h * 0.36], [w * 0.52, h * 0.365]], '#ffffff', 9, r);
    crayon(c, [[w * 0.535, h * 0.36], [w * 0.54, h * 0.365]], '#ffffff', 9, r);
    kidTextCentered(c, 'IL EST GENTIL', w * 0.5, h * 0.93, 34, '#d1262f', r);
  },
  hotel: (c, r, w, h) => {
    const b: Pt[] = [[w * 0.2, h * 0.15], [w * 0.8, h * 0.15], [w * 0.8, h * 0.85], [w * 0.2, h * 0.85]];
    scribble(c, b, '#c58a35', 10, r);
    crayon(c, [...b, b[0]], '#6b4a2b', 8, r);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 3; x++) {
        const cx = w * (0.3 + x * 0.2);
        const cy = h * (0.25 + y * 0.15);
        const lit = x === 1 && y === 0;
        const win: Pt[] = [[cx - 18, cy - 16], [cx + 18, cy - 16], [cx + 18, cy + 16], [cx - 18, cy + 16]];
        scribble(c, win, lit ? '#d1262f' : '#f5d76e', 8, r);
      }
    kidTextCentered(c, "L'OTEL", w * 0.5, h * 0.94, 40, '#2a4d8f', r);
  },
  rainbow: (c, r, w, h) => {
    ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'].forEach((col, k) => {
      const pts: Pt[] = [];
      for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.15) pts.push([w / 2 + Math.cos(a) * (w * 0.4 - k * 16), h * 0.7 + Math.sin(a) * (h * 0.5 - k * 16)]);
      crayon(c, pts, col, 14, r);
    });
    crayon(c, ell(w * 0.3, h * 0.78, 40, 22, r), '#999', 8, r);
    crayon(c, ell(w * 0.7, h * 0.78, 40, 22, r), '#999', 8, r);
    kidTextCentered(c, 'LEO', w * 0.5, h * 0.92, 40, '#2a4d8f', r, 'E');
  },
};

export const decoDrawing = (kind: DecoKind, seed: number): Texture =>
  canvasTexture(`r101-deco-${kind}`, [384, 320], (ctx, w, h) => {
    paper(ctx, w, h, seed, seed % 2 ? '#f6efdc' : '#eef1f4');
    waxLayer(ctx, w, h, seed, (c, r) => DECO[kind](c, r, w, h));
  });

// ─── Wallpaper (calm / changed) ───────────────────────────────────────────

/**
 * 256px pastel tile: star, crescent moon, bunny head. The `changed` variant
 * keeps the same layout but the star becomes an eye, the bunny loses its
 * eyes (hollow black) and the moon reads "404". Mixed per tile in a shader.
 */
export const wallpaperTile = (changed: boolean): Texture =>
  canvasTexture(`r101-wallpaper-${changed ? 'b' : 'a'}`, 256, (ctx, w) => {
    ctx.fillStyle = '#e4ece4';
    ctx.fillRect(0, 0, w, w);
    // Soft vertical stripes
    ctx.fillStyle = 'rgba(232,200,212,0.45)';
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 28, 0, 8, w);
    // Star (or eye) — top-left
    const sx = 64, sy = 64;
    if (!changed) {
      ctx.fillStyle = '#f2d27a';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const rad = k % 2 ? 9 : 20;
        ctx.lineTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#f4f0e6';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2b2b';
      ctx.beginPath();
      ctx.arc(sx + 3, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b07b7b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 20, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Crescent moon (or 404) — bottom-right
    const mx = 192, my = 190;
    if (!changed) {
      ctx.fillStyle = '#a9c4e4';
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e4ece4';
      ctx.beginPath();
      ctx.arc(mx + 10, my - 6, 19, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#9fb4cf';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('404', mx, my);
    }
    // Bunny head — center-ish
    const bx = 170, by = 78;
    ctx.fillStyle = '#efc4cf';
    ctx.beginPath();
    ctx.ellipse(bx - 9, by - 24, 6, 16, -0.15, 0, Math.PI * 2);
    ctx.ellipse(bx + 9, by - 24, 6, 16, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = changed ? '#1a1012' : '#6b4a55';
    const er = changed ? 5 : 2;
    ctx.beginPath();
    ctx.arc(bx - 6, by - 2, er, 0, Math.PI * 2);
    ctx.arc(bx + 6, by - 2, er, 0, Math.PI * 2);
    ctx.fill();
    if (changed) {
      ctx.fillRect(bx - 7, by + 2, 2, 9);
      ctx.fillRect(bx + 5, by + 2, 2, 7);
    }
    // Small dots
    ctx.fillStyle = 'rgba(160,190,170,0.8)';
    for (const [dx, dy] of [[30, 180], [110, 140], [230, 30], [120, 230]] as const) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, w, 0.04, 17);
  });

// ─── Small props ──────────────────────────────────────────────────────────

const BLOCK_COLORS = ['#e88b8b', '#8bb8e8', '#9ed69a', '#f2d27a', '#c7a0e0', '#f4a96a'];

export const blockFace = (letter: string, i: number): Texture =>
  canvasTexture(`r101-block-${letter}-${i}`, 128, (ctx, w) => {
    ctx.fillStyle = BLOCK_COLORS[i % BLOCK_COLORS.length];
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, w - 20);
    ctx.fillStyle = '#fff6e0';
    ctx.font = 'bold 84px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, w / 2, w / 2 + 6);
    speckle(ctx, w, w, 0.08, i + 3);
  });

export const rugTexture = () =>
  canvasTexture('r101-rug', 512, (ctx, w) => {
    const cols = ['#c9d9e8', '#f1d6dc', '#f6ebc8', '#cfe3d2', '#c9d9e8', '#e9dcef'];
    for (let k = 0; k < 12; k++) {
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, (w / 2) * (1 - k / 12), 0, Math.PI * 2);
      ctx.fill();
    }
    // braided texture
    const r = rng(8);
    ctx.strokeStyle = 'rgba(80,60,60,0.12)';
    for (let i = 0; i < 1600; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * w * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d);
      ctx.lineTo(w / 2 + Math.cos(a + 0.03) * d, w / 2 + Math.sin(a + 0.03) * d);
      ctx.stroke();
    }
    speckle(ctx, w, w, 0.06, 5);
  });

export const ballTexture = () =>
  canvasTexture('r101-ball', [256, 128], (ctx, w, h) => {
    const cols = ['#e74c3c', '#fdfaf0', '#3498db', '#fdfaf0', '#f1c40f', '#fdfaf0'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h);
    });
  });

/** Blanket: pastel gingham. */
export const blanketTexture = () =>
  canvasTexture('r101-blanket', 256, (ctx, w) => {
    ctx.fillStyle = '#f6e9ee';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(222,150,175,0.45)';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 16, w);
    for (let y = 0; y < w; y += 32) ctx.fillRect(0, y, w, 16);
    speckle(ctx, w, w, 0.05, 12);
  }, { repeat: [2, 2] });
