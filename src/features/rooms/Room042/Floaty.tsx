import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { sfx } from '@/lib/audio/sfx';
import { water } from './state';

export interface FloatyProps {
  children: ReactNode;
  position: [number, number, number];
  /** Extra height while submerged (falls back to 0 as the water drains). */
  lift?: number;
  /** Bob amplitude (m). */
  amp?: number;
  speed?: number;
  phase?: number;
  /** Rest rotation while floating [x, y, z] — returns to 0 when draining. */
  tilt?: [number, number, number];
  /** Slow spin around Y while floating (rad/s). */
  spin?: number;
  /** Play a thud when it lands. */
  heavy?: boolean;
}

/**
 * Wraps furniture that drifts in the water. Everything here eases back to the
 * floor when `water.drain` goes to 1 (the room empties on exit).
 */
export function Floaty({ children, position, lift = 0.2, amp = 0.04, speed = 0.6, phase = 0, tilt = [0, 0, 0], spin = 0, heavy = false }: FloatyProps) {
  const ref = useRef<Group>(null);
  const landed = useRef(false);
  const spun = useRef(0);

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * speed + phase;
    const k = 1 - water.drain;
    // Ease-in fall: furniture holds, then drops as the level passes it.
    const live = k * k * (3 - 2 * k);
    const m = water.reducedMotion ? 0.4 : 1;
    spun.current += spin * dt * live;
    g.position.set(
      position[0] + Math.sin(t * 0.7) * amp * 0.5 * live * m,
      position[1] + lift * live + Math.sin(t) * amp * live * m,
      position[2] + Math.cos(t * 0.6) * amp * 0.5 * live * m,
    );
    g.rotation.set(
      tilt[0] * live + Math.sin(t * 0.8) * 0.03 * live * m,
      tilt[1] * live + spun.current,
      tilt[2] * live + Math.cos(t * 0.9) * 0.03 * live * m,
    );
    if (heavy && !landed.current && water.drain > 0.93) {
      landed.current = true;
      sfx.thud([position[0], position[1], position[2]], 0.35);
    }
  });

  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}
