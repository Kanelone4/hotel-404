import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { input } from '@/lib/input/input';
import { useGame } from '@/stores/gameStore';
import { ui } from '@/stores/uiStore';
import { sfx } from '@/lib/audio/sfx';
import { player, yawForward } from './playerState';
import type { Box, Vec3 } from '@/types/game';

export type PlayerMode = 'walk' | 'swim' | 'locked';

export interface PlayerProps {
  /** Feet position on spawn. */
  start: Vec3;
  /** Initial yaw in radians — 0 looks toward -Z, Math.PI toward +Z. */
  yaw?: number;
  pitch?: number;
  /**
   * walk  — feet stay on `floorY`, XZ movement, crouch with C/Ctrl.
   * swim  — free 3D movement with inertia; Space up, C/Ctrl down.
   * locked — look only (elevator ride, cutscenes).
   */
  mode?: PlayerMode;
  /** Meters per second (walk) / max speed (swim). */
  speed?: number;
  eyeHeight?: number;
  crouchHeight?: number;
  radius?: number;
  floorY?: number;
  /** Feet stay inside this box. */
  bounds?: Box;
  /** Solid boxes the player cannot enter. */
  colliders?: Box[];
  /** Camera roll in radians (013 flips the view with Math.PI). */
  roll?: number;
  /** Footstep sounds while walking. */
  footsteps?: boolean;
  /** Mouse/touch look sensitivity multiplier. */
  sensitivity?: number;
  /** Max |pitch| in radians. */
  pitchLimit?: number;
}

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpWish = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * First-person controller. Writes the camera every frame unless
 * `player.controlsCamera` is false. Collision is a cheap circle-vs-AABB
 * (walk) / sphere-vs-AABB (swim) solve against `colliders`.
 */
export function Player({
  start,
  yaw = 0,
  pitch = 0,
  mode = 'walk',
  speed = 2.6,
  eyeHeight = 1.62,
  crouchHeight = 0.75,
  radius = 0.28,
  floorY = 0,
  bounds,
  colliders = [],
  roll = 0,
  footsteps = true,
  sensitivity = 1,
  pitchLimit = 1.35,
}: PlayerProps) {
  const camera = useThree((s) => s.camera);
  const smoothing = useGame((s) => s.cameraSmoothing);
  const reducedMotion = useGame((s) => s.reducedMotion);

  const look = useRef({ yaw, pitch, yawT: yaw, pitchT: pitch });
  const bob = useRef({ phase: 0, dist: 0 });
  const eye = useRef(eyeHeight);

  // (Re)spawn when the start transform changes.
  useEffect(() => {
    player.position.set(...start);
    player.velocity.set(0, 0, 0);
    player.yaw = yaw;
    player.pitch = pitch;
    player.controlsCamera = true;
    player.movementEnabled = true;
    look.current = { yaw, pitch, yawT: yaw, pitchT: pitch };
    eye.current = eyeHeight;
    input.lookX = 0;
    input.lookY = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start[0], start[1], start[2], yaw, pitch]);

  useEffect(() => {
    player.roll = roll;
  }, [roll]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const { transition, note, isTouch, pointerLocked } = ui();
    const active =
      player.movementEnabled && !transition.active && !note && (pointerLocked || isTouch);

    // ── Look ────────────────────────────────────────────────────────────
    const l = look.current;
    if (active) {
      const k = 0.0022 * sensitivity;
      // When the view is upside-down, horizontal look must be mirrored to feel natural.
      const flip = Math.cos(player.roll) < 0 ? -1 : 1;
      l.yawT -= input.lookX * k * flip;
      l.pitchT -= input.lookY * k * flip;
      l.pitchT = MathUtils.clamp(l.pitchT, -pitchLimit, pitchLimit);
    }
    input.lookX = 0;
    input.lookY = 0;
    const lookLerp = smoothing ? 1 - Math.exp(-dt * 22) : 1;
    l.yaw += (l.yawT - l.yaw) * lookLerp;
    l.pitch += (l.pitchT - l.pitch) * lookLerp;
    player.yaw = l.yaw;
    player.pitch = l.pitch;

    // ── Move ────────────────────────────────────────────────────────────
    let fwd = input.forward;
    let str = input.strafe;
    if (input.stick.x !== 0 || input.stick.y !== 0) {
      fwd = input.stick.y;
      str = input.stick.x;
    }
    if (!active || mode === 'locked') {
      fwd = 0;
      str = 0;
    }

    const crouch = active && mode === 'walk' && input.down;
    player.crouching = crouch;
    const targetEye = crouch ? crouchHeight : eyeHeight;
    eye.current += (targetEye - eye.current) * (1 - Math.exp(-dt * 10));
    player.crouchAmount = MathUtils.clamp((eyeHeight - eye.current) / (eyeHeight - crouchHeight || 1), 0, 1);

    const pos = player.position;
    const vel = player.velocity;

    if (mode === 'swim') {
      // Direction follows the full view (pitch included) — you swim where you look.
      tmpForward.set(0, 0, -1).applyEuler(camera.rotation).normalize();
      tmpRight.crossVectors(tmpForward, UP).normalize();
      tmpWish.set(0, 0, 0).addScaledVector(tmpForward, fwd).addScaledVector(tmpRight, str);
      if (active && input.up) tmpWish.y += 1;
      if (active && input.down) tmpWish.y -= 1;
      if (tmpWish.lengthSq() > 1) tmpWish.normalize();
      const accel = speed * 1.6;
      vel.addScaledVector(tmpWish, accel * dt);
      vel.multiplyScalar(Math.exp(-dt * 1.4)); // water drag
      if (vel.length() > speed) vel.setLength(speed);
      pos.addScaledVector(vel, dt);
    } else {
      const sprint = input.sprint ? 1.6 : 1;
      const crouchMul = crouch ? 0.45 : 1;
      yawForward(l.yaw, tmpForward);
      tmpRight.crossVectors(tmpForward, UP);
      tmpWish.set(0, 0, 0).addScaledVector(tmpForward, fwd).addScaledVector(tmpRight, str);
      if (tmpWish.lengthSq() > 1) tmpWish.normalize();
      tmpWish.multiplyScalar(speed * sprint * crouchMul);
      // Exponential approach = natural inertia without sliding.
      const k = 1 - Math.exp(-dt * 12);
      vel.x += (tmpWish.x - vel.x) * k;
      vel.z += (tmpWish.z - vel.z) * k;
      vel.y = 0;
      pos.x += vel.x * dt;
      pos.z += vel.z * dt;
      pos.y = floorY;
    }

    // ── Collide ─────────────────────────────────────────────────────────
    const headY = mode === 'swim' ? 0.4 : eye.current + 0.1;
    for (const c of colliders) {
      // Vertical overlap test (feet..head).
      if (pos.y + headY < c.min[1] || pos.y > c.max[1]) continue;
      const cx = MathUtils.clamp(pos.x, c.min[0], c.max[0]);
      const cz = MathUtils.clamp(pos.z, c.min[2], c.max[2]);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Center is inside the box: push out along the shallowest axis.
        const pen = [pos.x - c.min[0], c.max[0] - pos.x, pos.z - c.min[2], c.max[2] - pos.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) pos.x = c.min[0] - radius;
        else if (i === 1) pos.x = c.max[0] + radius;
        else if (i === 2) pos.z = c.min[2] - radius;
        else pos.z = c.max[2] + radius;
      }
    }
    if (bounds) {
      pos.x = MathUtils.clamp(pos.x, bounds.min[0] + radius, bounds.max[0] - radius);
      pos.y = MathUtils.clamp(pos.y, bounds.min[1], bounds.max[1]);
      pos.z = MathUtils.clamp(pos.z, bounds.min[2] + radius, bounds.max[2] - radius);
      if (mode === 'swim' && (pos.y === bounds.min[1] || pos.y === bounds.max[1])) vel.y = 0;
    }

    // ── Head bob + footsteps ────────────────────────────────────────────
    const horiz = Math.hypot(vel.x, vel.z);
    let bobY = 0;
    let bobRoll = 0;
    if (mode === 'walk') {
      bob.current.phase += horiz * dt * 2.2;
      const amp = reducedMotion ? 0 : Math.min(horiz / speed, 1.2) * 0.035;
      bobY = Math.abs(Math.sin(bob.current.phase * Math.PI)) * amp;
      bobRoll = Math.sin(bob.current.phase * Math.PI) * amp * 0.15;
      bob.current.dist += horiz * dt;
      if (footsteps && bob.current.dist > (crouch ? 0.55 : 0.75)) {
        bob.current.dist = 0;
        sfx.step(undefined, crouch ? 0.08 : 0.16);
      }
    } else if (mode === 'swim' && !reducedMotion) {
      bob.current.phase += dt;
      bobY = Math.sin(bob.current.phase * 1.3) * 0.04;
      bobRoll = Math.sin(bob.current.phase * 0.7) * 0.02;
    }

    player.eye.set(pos.x, pos.y + (mode === 'swim' ? 0 : eye.current) + bobY, pos.z);

    if (player.controlsCamera) {
      camera.position.copy(player.eye);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(l.pitch, l.yaw, player.roll + bobRoll);
    }
  });

  return null;
}
