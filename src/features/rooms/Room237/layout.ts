import type { Box, Vec3 } from '@/types/game';

/**
 * Suite 237 floor plan (meters, y up, floor at 0):
 *
 *            z=-3 ┌───────────────────────┬──────────┐
 *                 │ mattress  [inscr.]    │ BATHROOM │
 *                 │                       door  tub  │
 *          window ║        BEDROOM        ├──────────┘ z=-0.4
 *                 │          (bulb)       │
 *            z= 2 └──────────┐   ┌────────┘
 *                            │ C │  corridor
 *            z= 5            └─D─┘  entry door (closes by itself)
 *               x=-3.5     -0.6 0.6      2         4.5
 */
export const H = 2.7;

export const BEDROOM = { min: [-3.5, -3] as const, max: [2, 2] as const };
export const CORRIDOR = { min: [-0.6, 2] as const, max: [0.6, 5] as const };
export const BATH = { min: [2, -3] as const, max: [4.5, -0.4] as const };

/** Bathroom doorway (on the x=2 wall). */
export const BATH_DOOR = { zHinge: -1.4, zJamb: -2.3, width: 0.9 };
/** Entry door (z=5), hinge on the west side, swings outward (+z). */
export const ENTRY_DOOR = { xHinge: -0.45, z: 5, width: 0.9 };

export const SPAWN: Vec3 = [0, 0, 4.35];

export const BOUNDS: Box = { min: [-3.5, 0, -3], max: [4.5, 3, 5] };

export type WallKind = 'paper' | 'tile';
export interface Wall {
  /** Center (x, z). */
  c: [number, number];
  len: number;
  /** Y rotation so the plane's +Z normal faces the room interior. */
  ry: number;
  kind: WallKind;
  /** Vertical extent [bottom, top] (default full height). */
  y?: [number, number];
}

const PI = Math.PI;
const HP = PI / 2;

export const WALLS: Wall[] = [
  // Bedroom
  { c: [-0.75, -3], len: 5.5, ry: 0, kind: 'paper' },
  { c: [-3.5, -0.5], len: 5, ry: HP, kind: 'paper' },
  { c: [-2.05, 2], len: 2.9, ry: PI, kind: 'paper' },
  { c: [1.3, 2], len: 1.4, ry: PI, kind: 'paper' },
  { c: [0, 2], len: 1.2, ry: PI, kind: 'paper', y: [2.15, H] }, // archway lintel (bedroom side)
  { c: [2, -2.65], len: 0.7, ry: -HP, kind: 'paper' },
  { c: [2, 0.3], len: 3.4, ry: -HP, kind: 'paper' },
  { c: [2, -1.85], len: 0.9, ry: -HP, kind: 'paper', y: [2.1, H] }, // bath door lintel
  // Corridor
  { c: [-0.6, 3.5], len: 3, ry: HP, kind: 'paper' },
  { c: [0.6, 3.5], len: 3, ry: -HP, kind: 'paper' },
  { c: [0, 2], len: 1.2, ry: 0, kind: 'paper', y: [2.15, H] }, // archway lintel (corridor side)
  { c: [-0.525, 5], len: 0.15, ry: PI, kind: 'paper' },
  { c: [0.525, 5], len: 0.15, ry: PI, kind: 'paper' },
  { c: [0, 5], len: 0.9, ry: PI, kind: 'paper', y: [2.1, H] },
  // Bathroom
  { c: [3.25, -3], len: 2.5, ry: 0, kind: 'tile' },
  { c: [4.5, -1.7], len: 2.6, ry: -HP, kind: 'tile' },
  { c: [3.25, -0.4], len: 2.5, ry: PI, kind: 'tile' },
  { c: [2, -2.65], len: 0.7, ry: HP, kind: 'tile' },
  { c: [2, -0.9], len: 1.0, ry: HP, kind: 'tile' },
  { c: [2, -1.85], len: 0.9, ry: HP, kind: 'tile', y: [2.1, H] },
];

/** Solid regions + furniture. */
export const STATIC_COLLIDERS: Box[] = [
  { min: [-3.5, 0, 2], max: [-0.6, 3, 5] },
  { min: [0.6, 0, 2], max: [4.5, 3, 5] },
  { min: [1.97, 0, -0.4], max: [4.5, 3, 2] },
  { min: [1.97, 0, -3], max: [2.03, 3, -2.3] },
  { min: [1.97, 0, -1.4], max: [2.03, 3, -0.4] },
  // Furniture
  { min: [-3.3, 0, 0.85], max: [-1.4, 0.7, 1.85] }, // wardrobe lying down
  { min: [0.5, 0, -0.7], max: [1.3, 0.9, 0.1] }, // armchair on its side
  { min: [1.45, 0, 0.4], max: [1.95, 1.1, 1.6] }, // dresser
  { min: [-0.6, 0, -2.9], max: [-0.05, 0.5, -2.3] }, // nightstand
  { min: [3.72, 0, -2.95], max: [4.5, 0.65, -1.05] }, // bathtub
  { min: [2.95, 0, -0.75], max: [3.45, 0.9, -0.4] }, // sink
  { min: [-1.2, 0, 0.02], max: [-0.7, 1, 0.48] }, // chair
  { min: [-3.5, 0, -2.95], max: [-2.7, 1.5, -0.85] }, // bed frame on its side
];

export const BATH_DOOR_CLOSED: Box = { min: [1.98, 0, -2.2], max: [2.56, 3, -1.4] };
export const BATH_DOOR_OPEN: Box = { min: [2.0, 0, -1.5], max: [2.92, 3, -1.36] };

/** Where the carved inscription sits (back wall, above the mattress). */
export const INSCRIPTION = { x: -1.6, y: 1.45, z: -3, w: 1.3, h: 0.9 };
export const INSCRIPTION_POS: Vec3 = [INSCRIPTION.x, INSCRIPTION.y, INSCRIPTION.z + 0.01];

export const TUB = { x0: 3.72, x1: 4.5, z0: -2.95, z1: -1.05, h: 0.6 };
export const FRAGMENT_POS: Vec3 = [4.05, 0.12, -2.0];
