import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type PerspectiveCamera } from 'three';

/**
 * Scene-wide camera FOV. Rooms set `view.baseFov` (vertical FOV designed for a
 * landscape screen); <ResponsiveFov/> widens it on portrait screens so the
 * horizontal field of view never collapses into a slit on phones.
 */
export const view = { baseFov: 70 };

/** Vertical FOV that keeps at least `base`° horizontally when the screen is taller than wide. */
export function fitFov(base: number, aspect: number) {
  if (aspect >= 1) return base;
  const v = 2 * Math.atan(Math.tan(MathUtils.degToRad(base) / 2) / aspect);
  return Math.min(MathUtils.radToDeg(v), 105);
}

export function ResponsiveFov() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useFrame(() => {
    const target = fitFov(view.baseFov, aspect);
    if (Math.abs(camera.fov - target) > 0.01) {
      camera.fov = target;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
