import type { Box, Vec3 } from '@/types/game';

/** Chambre 101 — 4.5 × 5 m, ceiling 2.6 m. Origin at floor center. X: left/right, -Z: back wall. */
export const ROOM = { w: 4.5, d: 5, h: 2.6 } as const;
export const HX = ROOM.w / 2; // 2.25
export const HZ = ROOM.d / 2; // 2.5

export const BOUNDS: Box = { min: [-HX, 0, -HZ], max: [HX, ROOM.h, HZ] };
export const SPAWN: Vec3 = [0.4, 0, 1.9];

/** Child bed (lit à barreaux) against the left wall. */
export const BED = { x0: -2.2, x1: -1.42, z0: -1.95, z1: -0.35, base: 0.45, mattress: 0.64, rail: 0.95 } as const;
/** Teddy hidden under the bed, deep in the shadow. */
export const DOUDOU_HIDE: Vec3 = [-1.8, 0, -1.15];
/** Where it comes back to when you are not looking. */
export const DOUDOU_CRIB: Vec3 = [-1.85, BED.mattress, -1.6];

export const NIGHTSTAND = { x: -1.98, z: 0.05, h: 0.58 } as const;
/** Star projector / night-light origin. */
export const PROJECTOR: Vec3 = [-1.98, 0.72, 0.05];

export const WARDROBE = { x0: 1.68, x1: 2.25, z0: -1.95, z1: -0.85, h: 1.95 } as const;
export const CHEST = { x0: -0.55, x1: 0.55, z0: -2.5, z1: -2.1, h: 0.46 } as const;
export const MUSIC_BOX: Vec3 = [0.28, CHEST.h + 0.015, -2.28];
export const HORSE: Vec3 = [1.35, 0, 1.2];
export const RUG: Vec3 = [0.1, 0, -0.2];
export const PHOTO: Vec3 = [HX - 0.012, 1.42, 0.25];

/** The three puzzle drawings above the chest. */
export const PUZZLE_Y = 1.5;
export const PUZZLE_SIZE = 0.5;
export const PUZZLE_XS = [-0.56, 0, 0.56] as const;

export const COLLIDERS: Box[] = [
  { min: [BED.x0 - 0.05, 0, BED.z0 - 0.05], max: [BED.x1 + 0.04, 1.1, BED.z1 + 0.05] },
  { min: [NIGHTSTAND.x - 0.22, 0, NIGHTSTAND.z - 0.2], max: [NIGHTSTAND.x + 0.22, 0.8, NIGHTSTAND.z + 0.2] },
  { min: [WARDROBE.x0, 0, WARDROBE.z0], max: [WARDROBE.x1, WARDROBE.h, WARDROBE.z1] },
  { min: [CHEST.x0, 0, CHEST.z0], max: [CHEST.x1, CHEST.h + 0.2, CHEST.z1] },
  { min: [HORSE[0] - 0.42, 0, HORSE[2] - 0.16], max: [HORSE[0] + 0.42, 0.9, HORSE[2] + 0.16] },
];
