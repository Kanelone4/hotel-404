import { create } from 'zustand';
import type { Fragment, RoomId } from '@/types/game';

export type TransitionStyle = 'elevator' | 'fade' | 'glitch';

export interface Reward {
  room: RoomId;
  fragment: Fragment | null;
  title: string;
}

/** Extra touch button a room can register (e.g. 237's torch toggle — a key on desktop). */
export interface RoomAction {
  label: string;
  /** Accessible name. */
  aria: string;
  onPress: () => void;
  active?: boolean;
}

export interface Note {
  /** Short heading (e.g. "Papier plié"). */
  title?: string;
  body: string;
  /** Visual style of the note card. */
  variant?: 'paper' | 'child' | 'engraving' | 'system';
}

interface UIState {
  /** Label of the interactable under the crosshair (null = nothing). */
  hoverLabel: string | null;
  pointerLocked: boolean;
  isTouch: boolean;
  /** Full-screen transition overlay. */
  transition: { active: boolean; text: string; style: TransitionStyle };
  /** Scene finished mounting inside its Suspense boundary. */
  sceneReady: boolean;
  /** Contextual tutorial hint (bottom center). */
  hint: string | null;
  /** Short message (top center), auto-dismissed. */
  toast: { id: number; text: string } | null;
  /** Readable note modal — pauses movement while open. */
  note: Note | null;
  reward: Reward | null;
  /** True between room completion and the exit transition (rooms play their exit effect). */
  exiting: boolean;
  paused: boolean;
  roomAction: RoomAction | null;

  setHoverLabel: (l: string | null) => void;
  setPointerLocked: (v: boolean) => void;
  setIsTouch: (v: boolean) => void;
  startTransition: (text: string, style?: TransitionStyle) => void;
  endTransition: () => void;
  setSceneReady: (v: boolean) => void;
  setHint: (h: string | null) => void;
  showToast: (text: string) => void;
  showNote: (n: Note | null) => void;
  setReward: (r: Reward | null) => void;
  setExiting: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  setRoomAction: (a: RoomAction | null) => void;
}

let toastId = 0;

export const useUI = create<UIState>()((set) => ({
  hoverLabel: null,
  pointerLocked: false,
  isTouch: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  transition: { active: false, text: '', style: 'fade' },
  sceneReady: false,
  hint: null,
  toast: null,
  note: null,
  reward: null,
  exiting: false,
  paused: false,
  roomAction: null,

  setHoverLabel: (hoverLabel) => set({ hoverLabel }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setIsTouch: (isTouch) => set({ isTouch }),
  startTransition: (text, style = 'fade') => set({ transition: { active: true, text, style } }),
  endTransition: () => set((s) => ({ transition: { ...s.transition, active: false } })),
  setSceneReady: (sceneReady) => set({ sceneReady }),
  setHint: (hint) => set({ hint }),
  showToast: (text) => set({ toast: { id: ++toastId, text } }),
  showNote: (note) => set({ note }),
  setReward: (reward) => set({ reward }),
  setExiting: (exiting) => set({ exiting }),
  setPaused: (paused) => set({ paused }),
  setRoomAction: (roomAction) => set({ roomAction }),
}));

/**
 * Mirrors `isTouch` onto <html data-touch> so CSS can adapt layouts with the
 * `touch:` Tailwind variant. Hybrid devices switch on the first real touch.
 */
if (typeof window !== 'undefined') {
  const sync = (v: boolean) => document.documentElement.toggleAttribute('data-touch', v);
  sync(useUI.getState().isTouch);
  useUI.subscribe((s, prev) => {
    if (s.isTouch !== prev.isTouch) sync(s.isTouch);
  });
  window.addEventListener(
    'touchstart',
    () => {
      if (!useUI.getState().isTouch) useUI.setState({ isTouch: true });
    },
    { passive: true, once: true },
  );
}

export const ui = () => useUI.getState();
