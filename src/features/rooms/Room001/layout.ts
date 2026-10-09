import type { Box, Vec3 } from '@/types/game';

/**
 * Chambre 001 — floor plan (meters). Origin = room center on the floor.
 *
 *            z = -3  (window wall)
 *   ┌──────────[ window ]──────────┐
 *   │ NS                    chair  │
 *   │ ┌────────┐            TV ▐   │
 *   │ │  bed   │               ▐   │
 *   │ └────────┘          wardrobe │
 *   │                         ▐    │
 *   └──────────[door]──────────────┘
 *            z = +3  (corridor)
 *  x = -2.5                    x = +2.5
 */
export const ROOM = { w: 5, d: 6, h: 2.7, x0: -2.5, x1: 2.5, z0: -3, z1: 3 } as const;

export const BOUNDS: Box = { min: [ROOM.x0 + 0.05, 0, ROOM.z0 + 0.05], max: [ROOM.x1 - 0.05, ROOM.h, ROOM.z1 - 0.05] };

/** Bed: headboard against the left wall, runs along +X. */
export const BED = { x0: -2.45, x1: -0.45, z0: -1.4, z1: 0.2, frameH: 0.3, top: 0.58 } as const;
export const BED_CENTER: Vec3 = [(BED.x0 + BED.x1) / 2, 0, (BED.z0 + BED.z1) / 2];

/** Nightstand between bed and window wall; its front (drawer) faces +X. */
export const NIGHTSTAND = { x: -2.2, z: -1.78, w: 0.5, d: 0.46, h: 0.56 } as const;

/** Window opening in the far wall. */
export const WINDOW = { x: 0.25, y: 1.5, w: 1.6, h: 1.3 } as const;

/** Door in the corridor wall. */
export const DOOR = { x: 1.0, w: 0.92, h: 2.1 } as const;

export const DRESSER = { x0: 2.02, x1: 2.5, z0: -1.65, z1: -0.25, h: 0.74 } as const;
export const WARDROBE = { x0: 1.9, x1: 2.5, z0: 0.45, z1: 1.65, h: 2.15 } as const;
export const ARMCHAIR = { x: 1.55, z: -2.3, s: 0.78 } as const;

/** Pillow hiding the fragment (the one closest to the nightstand). */
export const KEY_PILLOW: Vec3 = [-2.12, BED.top + 0.08, -0.98];

export const LAMP_LIGHT: Vec3 = [NIGHTSTAND.x, NIGHTSTAND.h + 0.42, NIGHTSTAND.z];

export const SPAWN: Vec3 = [DOOR.x - 0.1, 0, 2.35];
/** Slightly turned toward the bed (positive yaw = left). */
export const SPAWN_YAW = 0.28;

export const COLLIDERS: Box[] = [
  { min: [BED.x0 - 0.05, 0, BED.z0 - 0.03], max: [BED.x1 + 0.03, 1.2, BED.z1 + 0.03] },
  {
    min: [NIGHTSTAND.x - NIGHTSTAND.d / 2 - 0.05, 0, NIGHTSTAND.z - NIGHTSTAND.w / 2],
    max: [NIGHTSTAND.x + NIGHTSTAND.d / 2, 1.1, NIGHTSTAND.z + NIGHTSTAND.w / 2],
  },
  { min: [DRESSER.x0, 0, DRESSER.z0], max: [DRESSER.x1, 1.2, DRESSER.z1] },
  { min: [WARDROBE.x0, 0, WARDROBE.z0], max: [WARDROBE.x1, WARDROBE.h, WARDROBE.z1] },
  {
    min: [ARMCHAIR.x - ARMCHAIR.s / 2, 0, ARMCHAIR.z - ARMCHAIR.s / 2],
    max: [ARMCHAIR.x + ARMCHAIR.s / 2, 0.9, ARMCHAIR.z + ARMCHAIR.s / 2],
  },
];
