import { PlaneGeometry } from 'three';

/** Plane whose UVs are scaled so a texture tiles every `tileW` × `tileH` meters; v offset by `y0`. */
export function tiledPlane(w: number, h: number, tileW: number, tileH: number, y0 = 0) {
  const g = new PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * w) / tileW, (y0 + uv.getY(i) * h) / tileH);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Peeling wallpaper strip, pivot on its top edge (y = 0, hangs toward -y).
 * The bottom curls away from the wall (+z) and the sheet bulges slightly.
 */
export function curledStrip(w: number, h: number, curl: number, bulge = 0.02) {
  const g = new PlaneGeometry(w, h, 6, 12);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const v = Math.min(1, Math.max(0, -y / h)); // 0 top → 1 bottom (clamped: pow() of a tiny negative is NaN)
    const u = x / w + 0.5;
    const z = Math.pow(v, 2.6) * curl + Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * bulge;
    p.setZ(i, z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
