import type { Box } from '@/types/game';

/** Hall dimensions (meters). Origin at floor center; entrance at +Z, elevator at -Z. */
export const HALL = {
  halfW: 7,
  front: 10,
  back: -10,
  height: 4.5,
  /** Elevator opening half-width and cabin depth. */
  doorHalf: 1.15,
  cabinDepth: 2.6,
  cabinHalf: 1.25,
  cabinHeight: 2.7,
} as const;

export const CABIN_CENTER_Z = HALL.back - HALL.cabinDepth / 2;

export const SPAWN_ENTRANCE: [number, number, number] = [0, 0, 8.2];
export const SPAWN_ELEVATOR: [number, number, number] = [0, 0, CABIN_CENTER_Z - 0.2];

/** Walkable volume: hall + cabin (back wall segments block everything but the opening). */
export const HALL_BOUNDS: Box = {
  min: [-HALL.halfW, 0, HALL.back - HALL.cabinDepth + 0.05],
  max: [HALL.halfW, 10, HALL.front - 0.4],
};

const wall = (x0: number, x1: number, z0: number, z1: number): Box => ({ min: [x0, 0, z0], max: [x1, HALL.height, z1] });

export const STATIC_COLLIDERS: Box[] = [
  // Back wall, left and right of the elevator opening.
  wall(-HALL.halfW, -HALL.doorHalf, HALL.back - 0.3, HALL.back + 0.15),
  wall(HALL.doorHalf, HALL.halfW, HALL.back - 0.3, HALL.back + 0.15),
  // Cabin side walls.
  wall(-HALL.halfW, -HALL.cabinHalf, HALL.back - HALL.cabinDepth - 0.5, HALL.back),
  wall(HALL.cabinHalf, HALL.halfW, HALL.back - HALL.cabinDepth - 0.5, HALL.back),
  // Reception desk.
  { min: [-6.4, 0, -1.4], max: [-4.1, 1.2, 4.4] },
  // Pillars.
  ...[-3.8, 3.8].flatMap((x) => [-5, 3].map((z) => wall(x - 0.35, x + 0.35, z - 0.35, z + 0.35))),
  // Lounge: armchairs + table.
  { min: [4.2, 0, -0.9], max: [6.9, 0.9, 2.9] },
  // Plants.
  wall(-6.9, -6.1, -9.6, -8.8),
  wall(6.1, 6.9, -9.6, -8.8),
];

/** Collider for the closed elevator doors. */
export const DOOR_COLLIDER: Box = wall(-HALL.doorHalf, HALL.doorHalf, HALL.back - 0.15, HALL.back + 0.1);
