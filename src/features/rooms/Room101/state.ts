import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Camera } from 'three';
import type { Vec3 } from '@/types/game';

/**
 * Per-frame mutable room state (never React state). Reset on room mount.
 *   unease — seconds elapsed since the teddy was taken (0 = calm, nostalgia phase)
 *   dying  — 0..1 exit blackout progress (lights & music die)
 *   solved — drawings puzzle solved (photo glitches harder)
 */
export const fx = {
  unease: 0,
  uneaseOn: false,
  dying: 0,
  solved: false,
  reducedMotion: false,
};

export function resetFx(reducedMotion: boolean) {
  fx.unease = 0;
  fx.uneaseOn = false;
  fx.dying = 0;
  fx.solved = false;
  fx.reducedMotion = reducedMotion;
}

const tmpDir = new Vector3();
const tmpFwd = new Vector3();

/** Cheap "is it on screen" test: cone around the camera forward (wider than the fov to be safe). */
export function isSeen(camera: Camera, at: Vec3 | Vector3, cone = 0.42) {
  if (at instanceof Vector3) tmpDir.copy(at);
  else tmpDir.set(at[0], at[1], at[2]);
  tmpDir.sub(camera.position);
  const len = tmpDir.length();
  if (len < 0.35) return true;
  camera.getWorldDirection(tmpFwd);
  return tmpDir.dot(tmpFwd) / len > cone;
}

/**
 * Fires `fire` once, after `after` seconds of unease, the first time `at` has
 * stayed off-screen for `hidden` seconds. Things only move when you don't look.
 */
export function useWhenUnseen(at: Vec3, after: number, fire: () => void, hidden = 0.6) {
  const state = useRef({ fired: false, unseen: 0 });
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useFrame(({ camera }, dt) => {
    const s = state.current;
    if (s.fired || !fx.uneaseOn || fx.unease < after || fx.dying > 0) return;
    if (isSeen(camera, at)) {
      s.unseen = 0;
      return;
    }
    s.unseen += dt;
    if (s.unseen > hidden) {
      s.fired = true;
      fireRef.current();
    }
  });
}
