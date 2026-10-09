import { PlaneGeometry } from 'three';
import { rng } from '@/lib/textures/procedural';

/**
 * Rumpled duvet, CPU-displaced once at mount.
 * Local frame: origin = center of the mattress top, X along the bed (head at −X),
 * Z across. `hx`/`hz` = mattress half extents. Vertices beyond the mattress edge
 * are pulled back to hug its side and dropped (the drape); inside, a sum of soft
 * lumps + diagonal wrinkles + a turned-back roll near the pillows sells "unmade".
 */
export function createDuvetGeometry(hx: number, hz: number) {
  const x0 = -hx * 0.48;
  const x1 = hx + 0.18;
  const z0 = -hz - 0.3;
  const z1 = hz + 0.3;
  const geo = new PlaneGeometry(x1 - x0, z1 - z0, 90, 70);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);

  const r = rng(1001);
  // Random soft lumps (a body-shaped hollow, bunched fabric…)
  const lumps = Array.from({ length: 9 }, () => ({
    x: x0 + r() * (hx - x0),
    z: (r() - 0.5) * hz * 1.6,
    s: 0.12 + r() * 0.25,
    a: (r() - 0.35) * 0.09,
  }));
  // A shallow hollow where someone lay.
  lumps.push({ x: 0.1, z: 0.18, s: 0.35, a: -0.05 });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let z = pos.getZ(i);

    // ── Surface rumple ───────────────────────────────────────────────
    let y = 0.05;
    for (const l of lumps) {
      const d2 = ((x - l.x) ** 2 + (z - l.z) ** 2) / (l.s * l.s);
      y += l.a * Math.exp(-d2);
    }
    y += 0.012 * Math.sin(x * 9 + z * 6.5) * Math.sin(z * 3.1 - x * 1.7);
    y += 0.006 * Math.sin(x * 23 - z * 17);
    // Turned-back roll near the head end.
    const roll = Math.exp(-(((x - (x0 + 0.12)) / 0.1) ** 2));
    y += 0.09 * roll * (0.8 + 0.2 * Math.sin(z * 5));
    y = Math.max(y, 0.008);

    // ── Drape over the sides and the foot ────────────────────────────
    const dz = Math.abs(z) - hz;
    const dx = x - hx;
    const over = Math.max(dz, dx, 0);
    if (over > 0) {
      const wave = 0.015 * Math.sin((dz > dx ? x : z) * 14);
      if (dz >= dx) z = Math.sign(z) * (hz + 0.03 + over * 0.08 + wave);
      else x = hx + 0.03 + over * 0.08 + wave;
      y = Math.min(y, 0.05) - over * 1.05;
      if (dz > 0 && dx > 0) y -= Math.min(dz, dx) * 0.4; // corner sag
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}
