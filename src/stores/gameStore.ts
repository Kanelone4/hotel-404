import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage/safeStorage';
import type { Fragment, RoomId, Vec3 } from '@/types/game';

/** Every fragment needed to open room 404. Order = order of the final code. */
export const ALL_FRAGMENTS: Fragment[] = ['1', '3', '2', '0', '4'];

export interface GameState {
  visitedRooms: RoomId[];
  completedRooms: RoomId[];
  fragments: Fragment[];
  muted: boolean;
  /** Not persisted: the AudioContext needs a fresh user gesture on every load. */
  audioEnabled: boolean;
  room404Unlocked: boolean;
  endingSeen: boolean;
  currentRoom: RoomId | null;
  /** Room the player last came back from — the hall spawns them in the elevator. */
  lastRoom: RoomId | null;
  playerPosition: Vec3;
  playerRotation: number;
  /** User comfort settings. */
  reducedMotion: boolean;
  cameraSmoothing: boolean;

  visitRoom: (id: RoomId) => void;
  completeRoom: (id: RoomId, fragment: Fragment | null) => void;
  addFragment: (f: Fragment) => void;
  toggleMute: () => void;
  enableAudio: () => void;
  unlock404: () => void;
  setEndingSeen: () => void;
  setCurrentRoom: (id: RoomId | null) => void;
  savePlayer: (position: Vec3, rotation: number) => void;
  setReducedMotion: (v: boolean) => void;
  setCameraSmoothing: (v: boolean) => void;
  reset: () => void;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const initial = {
  visitedRooms: [] as RoomId[],
  completedRooms: [] as RoomId[],
  fragments: [] as Fragment[],
  muted: false,
  audioEnabled: false,
  room404Unlocked: false,
  endingSeen: false,
  currentRoom: null,
  lastRoom: null,
  playerPosition: [0, 0, 8] as Vec3,
  playerRotation: 0,
  reducedMotion: Boolean(prefersReducedMotion),
  cameraSmoothing: true,
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,

      visitRoom: (id) =>
        set((s) => ({
          visitedRooms: s.visitedRooms.includes(id) ? s.visitedRooms : [...s.visitedRooms, id],
          currentRoom: id,
        })),

      completeRoom: (id, fragment) => {
        set((s) => ({
          completedRooms: s.completedRooms.includes(id)
            ? s.completedRooms
            : [...s.completedRooms, id],
          lastRoom: id,
        }));
        if (fragment) get().addFragment(fragment);
      },

      addFragment: (f) => {
        const fragments = get().fragments.includes(f) ? get().fragments : [...get().fragments, f];
        set({ fragments });
        if (ALL_FRAGMENTS.every((x) => fragments.includes(x))) get().unlock404();
      },

      toggleMute: () => set((s) => ({ muted: !s.muted })),
      enableAudio: () => set({ audioEnabled: true }),
      unlock404: () => set({ room404Unlocked: true }),
      setEndingSeen: () => set({ endingSeen: true }),
      setCurrentRoom: (id) => set((s) => ({ currentRoom: id, lastRoom: id ?? s.lastRoom })),
      savePlayer: (playerPosition, playerRotation) => set({ playerPosition, playerRotation }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setCameraSmoothing: (cameraSmoothing) => set({ cameraSmoothing }),
      reset: () => set({ ...initial, muted: get().muted, audioEnabled: get().audioEnabled }),
    }),
    {
      name: 'hotel-404:save',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ audioEnabled: _a, currentRoom: _c, ...rest }) => rest,
    },
  ),
);

/** Imperative read for code running outside React (useFrame, event handlers). */
export const game = () => useGame.getState();
