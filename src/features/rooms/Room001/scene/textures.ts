import { canvasTexture, rng, speckle } from '@/lib/textures/procedural';

/** Room-specific canvas textures (keys prefixed `r001-` to avoid cache clashes). */

/** Faded mustard damask wallpaper with thin stripes. */
export const wallpaperTex = (repeat: [number, number]) =>
  canvasTexture(
    'r001-wallpaper',
    256,
    (ctx, w) => {
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(0, 0, w, w);
      // Stripes
      for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = 'rgba(70,45,20,0.35)';
        ctx.fillRect(x, 0, 2, w);
        ctx.fillRect(x + 6, 0, 1, w);
      }
      // Medallions
      ctx.strokeStyle = 'rgba(60,38,18,0.45)';
      ctx.fillStyle = 'rgba(235,200,140,0.10)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 4; x++) {
          const cx = 32 + x * 64;
          const cy = 64 + y * 128 + (x % 2) * 64;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 16, 28, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, cy - 28);
          ctx.quadraticCurveTo(cx + 12, cy, cx, cy + 28);
          ctx.quadraticCurveTo(cx - 12, cy, cx, cy - 28);
          ctx.stroke();
        }
      // Age: soft stains
      const r = rng(41);
      for (let i = 0; i < 10; i++) {
        const g = ctx.createRadialGradient(r() * w, r() * w, 0, r() * w, r() * w, 30 + r() * 50);
        g.addColorStop(0, 'rgba(60,40,15,0.12)');
        g.addColorStop(1, 'rgba(60,40,15,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, w);
      }
      speckle(ctx, w, w, 0.07, 17);
    },
    { repeat },
  );

/** Shaggy brown/orange carpet with a faint geometric pattern. */
export const carpetTex = (repeat: [number, number]) =>
  canvasTexture(
    'r001-carpet',
    256,
    (ctx, w) => {
      ctx.fillStyle = '#4a2a17';
      ctx.fillRect(0, 0, w, w);
      ctx.strokeStyle = 'rgba(160,90,35,0.5)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w / 2, w / 2, 40 + i * 44, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(30,15,8,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, w - 8);
      // Pile fibers
      const r = rng(23);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(20,10,4,0.25)' : 'rgba(190,120,60,0.12)';
        ctx.fillRect(r() * w, r() * w, 1.5, 1.5);
      }
      speckle(ctx, w, w, 0.12, 5);
    },
    { repeat },
  );

/** Textured ("popcorn") ceiling. */
export const ceilingTex = () =>
  canvasTexture(
    'r001-ceiling',
    128,
    (ctx, w) => {
      ctx.fillStyle = '#c9bca2';
      ctx.fillRect(0, 0, w, w);
      speckle(ctx, w, w, 0.22, 31);
    },
    { repeat: [5, 6] },
  );

/** Duvet fabric: retro orange/brown stripes. */
export const duvetTex = () =>
  canvasTexture(
    'r001-duvet',
    256,
    (ctx, w) => {
      ctx.fillStyle = '#d8c39c';
      ctx.fillRect(0, 0, w, w);
      const bands = ['#b8612a', '#7a3a1c', '#d99a3e', '#5b3a22'];
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, 40 + i * 18, w, 10);
        ctx.fillRect(0, 168 + i * 12, w, 5);
      });
      speckle(ctx, w, w, 0.06, 9);
    },
    { repeat: [2, 2] },
  );

/** The painting above the bed depicts… this very room, lamp lit, bed unmade. */
export const paintingTex = () =>
  canvasTexture('r001-painting', [320, 220], (ctx, w, h) => {
    // Walls
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2a18');
    g.addColorStop(1, '#6b4a26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Floor
    ctx.fillStyle = '#3a1f10';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    // Window with fog
    ctx.fillStyle = '#4c5d70';
    ctx.fillRect(w * 0.56, h * 0.18, w * 0.24, h * 0.32);
    ctx.strokeStyle = '#d8c8a0';
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.56, h * 0.18, w * 0.24, h * 0.32);
    // Bed
    ctx.fillStyle = '#c99a5a';
    ctx.fillRect(w * 0.12, h * 0.56, w * 0.38, h * 0.16);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(w * 0.12, h * 0.52, w * 0.1, h * 0.06);
    // Lamp glow
    const lg = ctx.createRadialGradient(w * 0.07, h * 0.48, 0, w * 0.07, h * 0.48, w * 0.2);
    lg.addColorStop(0, 'rgba(255,200,120,0.95)');
    lg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    // A figure standing by the door — tiny, almost nothing.
    ctx.fillStyle = 'rgba(15,10,8,0.85)';
    ctx.fillRect(w * 0.9, h * 0.44, w * 0.025, h * 0.28);
    ctx.beginPath();
    ctx.arc(w * 0.9125, h * 0.42, w * 0.016, 0, Math.PI * 2);
    ctx.fill();
    // Brush strokes / varnish
    const r = rng(77);
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '255,230,180' : '0,0,0'},${0.03 + r() * 0.05})`;
      ctx.lineWidth = 1 + r() * 3;
      const x = r() * w;
      const y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 6);
      ctx.stroke();
    }
    speckle(ctx, w, h, 0.05, 12);
  });

/** Phosphorescent handwriting: "001" and an arrow pointing down at the pillow. */
export const writingTex = () =>
  canvasTexture('r001-writing', [256, 256], (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    ctx.font = 'italic 92px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(-0.06);
    ctx.fillText('001', 0, 0);
    ctx.restore();
    // Shaky arrow
    const r = rng(5);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.52);
    for (let y = 0.52; y <= 0.9; y += 0.04) ctx.lineTo(w * (0.5 + (r() - 0.5) * 0.02), h * y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.41, h * 0.8);
    ctx.lineTo(w * 0.5, h * 0.92);
    ctx.lineTo(w * 0.6, h * 0.79);
    ctx.stroke();
  });

/** "NE PAS DÉRANGER" door hanger. */
export const dndTex = () =>
  canvasTexture('r001-dnd', [128, 256], (ctx, w, h) => {
    ctx.fillStyle = '#b3261e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2e6cf';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.14, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2e6cf';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('NE PAS', w / 2, h * 0.48);
    ctx.fillText('DÉRANGER', w / 2, h * 0.6);
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillText('Hôtel 404', w / 2, h * 0.86);
  });

/** Folded hotel letterhead paper with one handwritten line. */
export const paperTex = () =>
  canvasTexture('r001-paper', [192, 256], (ctx, w, h) => {
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8a6a2e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.fillText('HÔTEL 404', w / 2, 26);
    ctx.fillRect(w * 0.2, 34, w * 0.6, 1);
    ctx.strokeStyle = 'rgba(30,30,60,0.75)';
    ctx.lineWidth = 1.6;
    const r = rng(3);
    for (let l = 0; l < 2; l++) {
      ctx.beginPath();
      const y = 90 + l * 22;
      ctx.moveTo(24, y);
      for (let x = 24; x < (l ? w * 0.5 : w - 24); x += 4) ctx.lineTo(x, y + Math.sin(x * 0.6) * 3 * r());
      ctx.stroke();
    }
    speckle(ctx, w, h, 0.04, 8);
  });

/** CRT "no signal" static frame. */
export const staticTex = () =>
  canvasTexture('r001-static', 128, (ctx, w) => {
    const img = ctx.createImageData(w, w);
    const r = rng(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
