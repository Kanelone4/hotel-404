import { canvasTexture, rng, speckle } from '@/lib/textures/procedural';

/**
 * Procedural textures for room 237 (all canvas-generated, cached by key).
 * Walls use a single non-repeating sheet; geometry UVs are scaled by length.
 */

type Ctx = CanvasRenderingContext2D;
type R = () => number;

/** Wallpaper sheet covers this many meters horizontally (and the full 2.7m height). */
export const PAPER_TILE_W = 3.6;

function jaggedPath(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Polygon of a vertical strip torn from the top, jagged sides and bottom. */
function tornStrip(r: R, x: number, w: number, len: number, top = -4): [number, number][] {
  const pts: [number, number][] = [[x, top]];
  const n = 10;
  for (let i = 1; i <= n; i++) pts.push([x - r() * 8 + (r() - 0.5) * 6, top + (len * i) / n]);
  const bottom = 7;
  for (let i = 1; i < bottom; i++) pts.push([x + (w * i) / bottom, top + len - r() * len * 0.25]);
  for (let i = n; i >= 1; i--) pts.push([x + w + r() * 8, top + (len * i) / n * (0.6 + 0.4 * r())]);
  pts.push([x + w, top]);
  return pts;
}

function blob(r: R, cx: number, cy: number, rx: number, ry: number, n = 16, jag = 0.45): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jag / 2 + r() * jag;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Plaster underneath: mottled beige-grey with hairline cracks. */
function plaster(ctx: Ctx, r: R, w: number, h: number) {
  ctx.fillStyle = '#8c8574';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '40,34,26' : '190,182,160'},${0.05 + r() * 0.08})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 6 + r() * 40, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,24,18,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let x = r() * w;
    let y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.5) * 40;
      y += r() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function moldCluster(ctx: Ctx, r: R, cx: number, cy: number, radius: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = radius * Math.pow(r(), 0.7);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.8;
    const s = 1 + r() * 5 * (1 - d / radius);
    ctx.fillStyle = r() > 0.3 ? `rgba(14,20,10,${0.2 + r() * 0.5})` : `rgba(70,78,38,${0.1 + r() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Water stain: vertical tide-marked drip from the top. */
function waterStain(ctx: Ctx, r: R, x: number, len: number, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, 'rgba(60,38,16,0.45)');
  g.addColorStop(0.7, 'rgba(70,45,20,0.22)');
  g.addColorStop(1, 'rgba(70,45,20,0)');
  ctx.fillStyle = g;
  jaggedPath(ctx, [
    [x - w / 2, 0],
    [x + w / 2, 0],
    [x + w * 0.35 + r() * 10, len * 0.6],
    [x + 4, len],
    [x - 4, len * (0.8 + r() * 0.2)],
    [x - w * 0.4 - r() * 10, len * 0.5],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,30,12,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function damask(ctx: Ctx, w: number, h: number, base: string, ink: string, cell = 128) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ink;
  for (let x = 0; x < w; x += cell / 2) ctx.fillRect(x, 0, 3, h);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  for (let y = 0; y < h / cell + 1; y++)
    for (let x = 0; x < w / cell + 1; x++) {
      const cx = x * cell + (y % 2) * (cell / 2);
      const cy = y * cell + cell / 2;
      const s = cell / 128;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20 * s, 40 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(cx, cy - 46 * s);
      ctx.lineTo(cx, cy + 46 * s);
      ctx.moveTo(cx - 26 * s, cy);
      ctx.bezierCurveTo(cx - 10 * s, cy - 30 * s, cx + 10 * s, cy - 30 * s, cx + 26 * s, cy);
      ctx.moveTo(cx - 26 * s, cy + 14 * s);
      ctx.bezierCurveTo(cx - 10 * s, cy + 40 * s, cx + 10 * s, cy + 40 * s, cx + 26 * s, cy + 14 * s);
      ctx.stroke();
    }
}

const PAPER_BASE = '#6a6340';
const PAPER_INK = '#544e2e';

/** Mustard damask wallpaper, stained, torn in strips revealing plaster, moldy at the base. */
export const tornWallpaper = () =>
  canvasTexture(
    'r237-wallpaper',
    [1024, 768],
    (ctx, w, h) => {
      const r = rng(237);
      damask(ctx, w, h, PAPER_BASE, PAPER_INK);
      // Smoke at the top, grime at the bottom.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(25,18,10,0.55)');
      g.addColorStop(0.25, 'rgba(25,18,10,0.1)');
      g.addColorStop(0.75, 'rgba(20,18,10,0.1)');
      g.addColorStop(1, 'rgba(15,14,8,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) waterStain(ctx, r, r() * w, 150 + r() * 420, 40 + r() * 90);

      // Tears: strips fallen from the top + a few holes.
      const tears: [number, number][][] = [];
      for (let i = 0; i < 3; i++) tears.push(tornStrip(r, 60 + r() * (w - 220), 50 + r() * 110, 180 + r() * 420));
      for (let i = 0; i < 3; i++) tears.push(blob(r, r() * w, 260 + r() * 400, 30 + r() * 60, 25 + r() * 70));
      for (const t of tears) {
        ctx.save();
        jaggedPath(ctx, t);
        ctx.clip();
        plaster(ctx, r, w, h);
        ctx.restore();
        // Shadowed lip + lighter paper edge where it curls.
        jaggedPath(ctx, t);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.translate(-1.5, -1.5);
        jaggedPath(ctx, t);
        ctx.strokeStyle = 'rgba(214,200,150,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // Mold creeping up from the floor and down from the corners.
      for (let i = 0; i < 7; i++) moldCluster(ctx, r, r() * w, h - r() * 60, 40 + r() * 90, 260);
      moldCluster(ctx, r, 10, 20, 90, 300);
      moldCluster(ctx, r, w - 10, 30, 70, 220);

      // Scratches.
      ctx.strokeStyle = 'rgba(20,16,10,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const x = r() * w;
        const y = 200 + r() * 450;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 30, y + 20 + r() * 70);
        ctx.stroke();
      }
      speckle(ctx, w, h, 0.09, 23);
    },
    { anisotropy: 4 },
  );

/** Wallpaper scrap with jagged transparent edges (alphaTest) — hanging strips and the cover over the inscription. */
export const paperStrip = (seed = 3) =>
  canvasTexture(`r237-strip-${seed}`, [256, 512], (ctx, w, h) => {
    const r = rng(seed);
    ctx.save();
    const pts: [number, number][] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) pts.push([4 + r() * 10, (h * i) / n]);
    for (let i = 0; i <= 8; i++) pts.push([(w * i) / 8, h - 6 - r() * 50]);
    for (let i = n; i >= 0; i--) pts.push([w - 4 - r() * 10, (h * i) / n]);
    jaggedPath(ctx, pts);
    ctx.clip();
    damask(ctx, w, h, PAPER_BASE, PAPER_INK, 64);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(25,18,10,0.35)');
    g.addColorStop(1, 'rgba(25,18,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    waterStain(ctx, r, w * (0.3 + r() * 0.4), h * 0.7, 60);
    moldCluster(ctx, r, w * r(), h * 0.9, 60, 140);
    speckle(ctx, w, h, 0.08, seed);
    ctx.restore();
  });

/** Bare plaster patch with a jagged torn border (behind the inscription). */
export const plasterPatch = () =>
  canvasTexture('r237-plaster-patch', 512, (ctx, w, h) => {
    const r = rng(77);
    const pts = blob(r, w / 2, h / 2, w * 0.47, h * 0.46, 40, 0.18);
    ctx.save();
    jaggedPath(ctx, pts);
    ctx.clip();
    plaster(ctx, r, w, h);
    speckle(ctx, w, h, 0.07, 4);
    ctx.restore();
    jaggedPath(ctx, pts);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 6;
    ctx.stroke();
  });

/**
 * Carving mask (white = gouged). Each glyph is scratched several times with
 * jitter so it reads as hand-carved, not printed.
 */
export const inscriptionMask = () =>
  canvasTexture(
    'r237-inscription',
    [1024, 640],
    (ctx, w, h) => {
      const r = rng(404);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const carve = (text: string, x: number, y: number, size: number, rot: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.font = `bold ${size}px "Courier New", monospace`;
        let cx = -ctx.measureText(text).width / 2;
        for (const ch of text) {
          const cw = ctx.measureText(ch).width;
          for (let k = 0; k < 4; k++) {
            ctx.lineWidth = 2 + r() * 3;
            ctx.globalAlpha = 0.5 + r() * 0.5;
            ctx.save();
            ctx.translate(cx + cw / 2 + (r() - 0.5) * 5, (r() - 0.5) * 8);
            ctx.rotate((r() - 0.5) * 0.12);
            ctx.strokeText(ch, 0, 0);
            ctx.restore();
          }
          cx += cw * (0.95 + r() * 0.15);
        }
        ctx.restore();
      };
      carve('SOUS LA', w * 0.47, h * 0.22, 130, -0.03);
      carve('BAIGNOIRE', w * 0.5, h * 0.47, 150, 0.02);
      // Tally: four strokes, the fourth one deeper.
      for (let i = 0; i < 4; i++) {
        const x = w * 0.36 + i * 70;
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.7 + r() * 0.3;
          ctx.lineWidth = i === 3 ? 11 : 6 + r() * 3;
          ctx.beginPath();
          ctx.moveTo(x + (r() - 0.5) * 6, h * 0.66);
          ctx.lineTo(x + 12 + (r() - 0.5) * 6, h * 0.9);
          ctx.stroke();
        }
      }
      // Fingernail scratches around it.
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 26; i++) {
        const x = r() * w;
        const y = r() * h;
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 50, y + 30 + r() * 90);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    { color: false, anisotropy: 4 },
  );

/** Worn floorboards with dust and stains (2m × 2m). */
export const floorboards = () =>
  canvasTexture('r237-floor', 512, (ctx, w, h) => {
    const r = rng(12);
    const rows = 10;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 200;
      while (x < w) {
        const len = 180 + r() * 260;
        const l = 22 + r() * 14;
        ctx.fillStyle = `hsl(${24 + r() * 8},${30 + r() * 15}%,${l * 0.6}%)`;
        ctx.fillRect(x, i * rh, len, rh);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
          ctx.fillRect(x, i * rh + r() * rh, len, 1 + r() * 2);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x, i * rh, 2, rh);
        x += len;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, i * rh, w, 2);
    }
    for (let i = 0; i < 16; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const dust = r() > 0.4;
      g.addColorStop(0, dust ? 'rgba(150,140,120,0.22)' : 'rgba(20,10,4,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(r() * w, r() * h);
      ctx.scale(40 + r() * 90, 30 + r() * 70);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    speckle(ctx, w, h, 0.1, 12);
  });

/** Stained ceiling plaster with concentric water rings. */
export const ceiling = () =>
  canvasTexture('r237-ceiling', 512, (ctx, w, h) => {
    const r = rng(31);
    ctx.fillStyle = '#4a463e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const x = r() * w;
      const y = r() * h;
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = `rgba(60,36,14,${0.25 + r() * 0.2})`;
        ctx.lineWidth = 2 + r() * 3;
        ctx.beginPath();
        ctx.ellipse(x, y, 30 + k * 22 + r() * 10, 24 + k * 18 + r() * 10, r(), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 4; i++) moldCluster(ctx, r, r() * w, r() * h, 50, 160);
    speckle(ctx, w, h, 0.1, 31);
  });

/** Old carpet runner for the corridor. */
export const corridorCarpet = () =>
  canvasTexture('r237-carpet', 256, (ctx, w, h) => {
    const r = rng(8);
    ctx.fillStyle = '#3a1712';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#522a19';
    ctx.lineWidth = 6;
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + ((x / 32) % 2) * 20);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '10,5,2' : '120,100,80'},${0.15 + r() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 10 + r() * 40, 8 + r() * 30, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, h, 0.14, 8);
  });

/** Dirty ceramic wall tiles with cracks and missing tiles (1m × 1m). */
export const bathTiles = () =>
  canvasTexture('r237-bathtiles', 512, (ctx, w, h) => {
    const r = rng(19);
    const n = 8;
    const s = w / n;
    ctx.fillStyle = '#4b4a3c';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (r() < 0.05) {
          ctx.fillStyle = '#3a342a';
          ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
          continue;
        }
        const l = 62 + r() * 10;
        ctx.fillStyle = `hsl(${80 + r() * 30},${10 + r() * 8}%,${l}%)`;
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
    for (let i = 0; i < 6; i++) waterStain(ctx, r, r() * w, 200 + r() * 300, 50);
    ctx.strokeStyle = 'rgba(20,18,12,0.6)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      let x = r() * w;
      let y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 50;
        y += (r() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) moldCluster(ctx, r, r() * w, h - r() * 50, 70, 200);
    speckle(ctx, w, h, 0.07, 19);
  });

/** Checkered bathroom floor, grimy. */
export const bathFloor = () =>
  canvasTexture('r237-bathfloor', 256, (ctx, w, h) => {
    const r = rng(5);
    const n = 8;
    const s = w / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#1b1a17' : '#7d786a';
        ctx.fillRect(x * s, y * s, s, s);
      }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(40,28,14,${0.2 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 10 + r() * 40, 8 + r() * 30, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, h, 0.12, 5);
  });

/** Striped mattress ticking with large stains and a tear. */
export const mattress = () =>
  canvasTexture('r237-mattress', 512, (ctx, w, h) => {
    const r = rng(66);
    ctx.fillStyle = '#a9a28e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5d6672';
    for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 7, h);
    for (let i = 0; i < 7; i++) {
      const cx = r() * w;
      const cy = r() * h;
      const rad = 30 + r() * 110;
      const g = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      g.addColorStop(0, 'rgba(90,60,20,0.55)');
      g.addColorStop(0.85, 'rgba(110,75,25,0.35)');
      g.addColorStop(1, 'rgba(70,45,15,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    moldCluster(ctx, r, w * 0.2, h * 0.8, 120, 500);
    jaggedPath(ctx, blob(r, w * 0.65, h * 0.35, 60, 18, 12, 0.6));
    ctx.fillStyle = '#d9cfb0';
    ctx.fill();
    speckle(ctx, w, h, 0.1, 66);
  });

/** Broken mirror: dark glass with radial cracks and a missing shard. */
export const brokenMirror = () =>
  canvasTexture('r237-mirror', 512, (ctx, w, h) => {
    const r = rng(13);
    ctx.fillStyle = '#596163';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.42;
    const cy = h * 0.38;
    // Missing shard (backing board shows through).
    jaggedPath(ctx, [
      [cx, cy],
      [cx + 140, cy - 60],
      [cx + 170, cy + 40],
      [cx + 60, cy + 30],
    ]);
    ctx.fillStyle = '#1a1612';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,235,230,0.8)';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3;
      let x = cx;
      let y = cy;
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += Math.cos(a + (r() - 0.5) * 0.4) * 50;
        y += Math.sin(a + (r() - 0.5) * 0.4) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let ring = 1; ring < 4; ring++) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = ring * 45 + r() * 20;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    // Desilvering at the edges.
    for (let i = 0; i < 300; i++) {
      const edge = r() < 0.5;
      ctx.fillStyle = `rgba(20,18,14,${r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(edge ? r() * w : r() < 0.5 ? r() * 30 : w - r() * 30, edge ? (r() < 0.5 ? r() * 30 : h - r() * 30) : r() * h, 2 + r() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

/** Mold decal (transparent background). */
export const moldDecal = (seed = 1) =>
  canvasTexture(`r237-mold-${seed}`, 256, (ctx, w, h) => {
    const r = rng(seed * 97);
    ctx.clearRect(0, 0, w, h);
    moldCluster(ctx, r, w / 2, h / 2, w * 0.42, 900);
    moldCluster(ctx, r, w * 0.3, h * 0.6, w * 0.2, 300);
  });

/** Flashlight cookie: hot center, dimmer ring, dark ring, soft spill (classic incandescent torch). */
export const flashCookie = () =>
  canvasTexture('r237-cookie', 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, '#f4efe4');
    g.addColorStop(0.32, '#9a958c');
    g.addColorStop(0.38, '#c9c3b6');
    g.addColorStop(0.46, '#5a564f');
    g.addColorStop(0.75, '#3a3733');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    // Smudges on the lens.
    const r = rng(9);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`;
      ctx.beginPath();
      ctx.arc(c + (r() - 0.5) * c, c + (r() - 0.5) * c, 8 + r() * 25, 0, Math.PI * 2);
      ctx.fill();
    }
  });
