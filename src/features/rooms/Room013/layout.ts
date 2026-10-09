import type { Box, Vec3 } from '@/types/game';

/**
 * Chambre 013 is authored as a perfectly normal hotel room (floor at local
 * y = 0, ceiling at local y = H) and then rotated π around Z inside
 * <FlippedRoom/>. The player walks on the *ceiling*, which lands on world y = 0.
 *
 *   local (x, y, z)  →  world (-x, H - y, z)
 *
 * Physics bodies, audio and the camera rig live in world space (outside the
 * flipped group), so we convert with `toWorld` whenever both must agree.
 */
export const H = 3.4;
export const HALF_W = 3.5; // x
export const HALF_D = 4; // z

export const toWorld = (x: number, y: number, z: number): Vec3 => [-x, H - y, z];

/** Player spawn (world, feet) — near the door, looking at the bed. */
export const SPAWN: Vec3 = [0, 0, 2.8];

export const BOUNDS: Box = { min: [-HALF_W, 0, -HALF_D], max: [HALF_W, H, HALF_D] };

// ── Furniture placement (local, right-side-up coordinates) ────────────────
export const BED = { x: 0, z: -2.95, w: 1.7, l: 2.1, frame: 0.35, top: 0.6 };
export const NIGHTSTANDS: [number, number][] = [
  [-1.25, -3.7],
  [1.25, -3.7],
];
export const NIGHTSTAND = { w: 0.5, h: 0.55, d: 0.45 };
export const WARDROBE = { x: -3.15, z: 1.3, w: 0.62, h: 2.1, d: 1.4 };
export const TABLE = { x: 2.45, z: 1.5, w: 1.0, d: 0.8, h: 0.75 };
export const FLOOR_LAMP = { x: 3.0, z: -1.4, h: 1.8 };
export const CHANDELIER = { x: 0, z: 0.9, drop: 1.3 };
export const DOOR = { x: -2.1, w: 0.95, h: 2.1 };
export const WINDOW = { z: 0.2, y: 1.55, w: 1.6, h: 1.3 };

/** The key "3" lies on the carpet beside the bed (local), i.e. glued above the player's head. */
export const KEY_LOCAL: Vec3 = [1.3, 0.015, -2.55];
export const KEY_WORLD: Vec3 = toWorld(...KEY_LOCAL);

// ── The ceiling mirror (above the bed in the normal room = in the player's floor) ──
export const MIRROR_Y = 0.004;
export const MIRROR = { cx: 0, cz: -2.55, w: 3.4, d: 2.9 };
/** Where the key appears in the mirror (virtual image below the floor). */
export const KEY_REFLECTION: Vec3 = [KEY_WORLD[0], 2 * MIRROR_Y - KEY_WORLD[1], KEY_WORLD[2]];

export const insideMirror = (x: number, z: number, margin = 0.05) =>
  Math.abs(x - MIRROR.cx) < MIRROR.w / 2 - margin && Math.abs(z - MIRROR.cz) < MIRROR.d / 2 - margin;

// ── Player colliders (world). Things that hang low enough to hit your head. ──
const chW = toWorld(CHANDELIER.x, 0, CHANDELIER.z);
const wrW = toWorld(WARDROBE.x, 0, WARDROBE.z);
const flW = toWorld(FLOOR_LAMP.x, 0, FLOOR_LAMP.z);
export const COLLIDERS: Box[] = [
  // Chandelier: grows out of the player's floor like a crystal shrub.
  { min: [chW[0] - 0.3, 0, chW[2] - 0.3], max: [chW[0] + 0.3, CHANDELIER.drop, chW[2] + 0.3] },
  // Wardrobe hangs down to y = H - 2.1 = 1.3 — crouch (C / Ctrl) to pass beneath.
  { min: [wrW[0] - WARDROBE.w / 2, H - WARDROBE.h, wrW[2] - WARDROBE.d / 2], max: [wrW[0] + WARDROBE.w / 2, H, wrW[2] + WARDROBE.d / 2] },
  // Floor lamp hangs down to y = 1.6.
  { min: [flW[0] - 0.22, H - FLOOR_LAMP.h, flW[2] - 0.22], max: [flW[0] + 0.22, H, flW[2] + 0.22] },
];
