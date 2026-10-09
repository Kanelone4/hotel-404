import { Vector3 } from 'three';
import type { Box, Vec3 } from '@/types/game';

/** Room 042 — a drowned double room. Door on +Z, window on +X, bed against -Z. */
export const ROOM = { minX: -4, maxX: 4, minZ: -5, maxZ: 5, height: 3.2 } as const;

/**
 * Air pocket: a collapsed ceiling well near the door. The water surface sits
 * inside the shaft, above the ceiling line — the only place you can breathe.
 */
export const POCKET = { x: 2.5, z: 3.0, half: 0.7, top: 4.6, surface: 3.6 } as const;

/** Swim mode: position = eye. */
export const START: Vec3 = [0.2, 1.5, 4.1];
/** Max eye height everywhere except inside the pocket shaft. */
export const CEIL_EYE = 2.95;
/** Max eye height inside the shaft (head above the surface). */
export const POCKET_EYE = 3.85;
export const BOUNDS: Box = { min: [ROOM.minX, 0.32, ROOM.minZ], max: [ROOM.maxX, POCKET_EYE, ROOM.maxZ] };

export const BED = { x: -1.2, z: -3.95, w: 2.0, l: 2.1 } as const;

export const COLLIDERS: Box[] = [
  // Bed (you can swim over it, and peek under it from the foot side).
  { min: [-2.25, 0, -5], max: [-0.15, 1.0, -2.85] },
  // Nightstands.
  { min: [-3.1, 0, -5], max: [-2.4, 0.75, -4.4] },
  { min: [0.0, 0, -5], max: [0.7, 0.75, -4.4] },
  // Wardrobe (left wall).
  { min: [-4, 0, -0.6], max: [-3.35, 2.35, 1.4] },
  // Desk (right wall).
  { min: [3.25, 0, -1.6], max: [4, 0.82, 0.4] },
];

/** Where the fragment lies — in the silt, under the bed. */
export const FRAGMENT_POS: Vec3 = [-1.15, 0.05, -3.75];

/** Fish loiters here until you come close. */
export const FISH_IDLE = new Vector3(0.4, 1.45, 1.6);

/** The path the fish leads you along (desk → window → foot of the bed → under it). */
export const FISH_PATH: Vector3[] = [
  new Vector3(1.4, 1.8, 0.6),
  new Vector3(2.6, 1.35, -0.9),
  new Vector3(2.4, 1.1, -3.1),
  new Vector3(0.5, 0.75, -2.35),
  new Vector3(-1.15, 0.42, -2.45),
  new Vector3(-1.15, 0.24, -3.4),
];

/** Fish hovers here, lighting the fragment. */
export const FISH_REVEAL = new Vector3(-1.15, 0.26, -3.45);
