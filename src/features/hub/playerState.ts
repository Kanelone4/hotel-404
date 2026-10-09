import { Vector3 } from 'three';

/**
 * Live player state, readable from any scene (proximity triggers, fish that
 * follow the player, etc.). Mutated by <Player/> every frame — never put it in
 * React state.
 */
export const player = {
  /** Feet position in world space. */
  position: new Vector3(),
  /** Eye (camera) position in world space. */
  eye: new Vector3(),
  velocity: new Vector3(),
  yaw: 0,
  pitch: 0,
  /** Extra camera roll (radians) — e.g. room 013 flips the world. */
  roll: 0,
  crouching: false,
  /** 0..1 how crouched the eye currently is. */
  crouchAmount: 0,
  /**
   * When false, <Player/> stops writing to the camera so a scene can run a
   * cutscene (GSAP / useFrame) and later hand control back.
   */
  controlsCamera: true,
  /** When false, input is ignored (notes, transitions, cutscenes). */
  movementEnabled: true,
};

/** Forward direction (on the XZ plane) for a yaw angle. yaw 0 looks toward -Z. */
export function yawForward(yaw: number, out = new Vector3()) {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}
