import { create } from 'zustand';
import { Color } from 'three';

export type FishPhase = 'idle' | 'lead' | 'reveal' | 'taken';

/** React-visible room state (DOM gauge, fragment visibility). Updated at a low rate. */
interface Room042State {
  o2: number;
  /** Head above the pocket's surface. */
  breathing: boolean;
  /** Black overlay on (oxygen ran out). */
  blackout: boolean;
  phase: FishPhase;
  /** Fish is waiting for the player to catch up. */
  fishWaiting: boolean;
  set: (p: Partial<Omit<Room042State, 'set'>>) => void;
}

export const useRoom042 = create<Room042State>()((set) => ({
  o2: 1,
  breathing: false,
  blackout: false,
  phase: 'idle',
  fishWaiting: false,
  set: (p) => set(p),
}));

export const r042 = () => useRoom042.getState();

/**
 * Per-frame shared values (mutated in useFrame, never trigger React).
 * `drain` 0 → 1 while the room empties on exit.
 */
export const water = {
  time: 0,
  drain: 0,
  /** Current water level (world Y) — only meaningful while draining. */
  level: 3.6,
  /** 1 when the camera is under water, 0 when above the surface. */
  submerged: 1,
  reducedMotion: false,
};

/** Uniforms shared by every material patched with caustics / sway. */
export const shared = {
  uTime: { value: 0 },
  uCaustic: { value: 1.25 },
  uCColor: { value: new Color('#a8f0ff') },
  uDrain: { value: 0 },
  uMotion: { value: 1 },
};

/** Live mixer values polled by the custom synth voices. */
export const mix = {
  cutoff: 480,
};

export function resetRoom042() {
  useRoom042.setState({ o2: 1, breathing: false, blackout: false, phase: 'idle', fishWaiting: false });
  water.time = 0;
  water.drain = 0;
  water.level = 3.6;
  water.submerged = 1;
  shared.uDrain.value = 0;
  shared.uCaustic.value = 1.25;
  mix.cutoff = 480;
}
