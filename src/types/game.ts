export type Fragment = '0' | '1' | '2' | '3' | '4';
export type RoomId = '001' | '013' | '042' | '101' | '237' | '404';
export type Vec3 = [number, number, number];

/** Axis-aligned box used by the lightweight player collision system. */
export interface Box {
  min: Vec3;
  max: Vec3;
}
