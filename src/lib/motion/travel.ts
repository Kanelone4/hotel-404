import { ui, type TransitionStyle } from '@/stores/uiStore';
import { sfx } from '@/lib/audio/sfx';
import { router } from '@/app/router';

export type Spawn = 'entrance' | 'elevator';

let spawn: Spawn = 'entrance';
let transitionStartedAt = 0;
let busy = false;

/** Where the hall should spawn the player on next mount. */
export const getSpawn = () => spawn;

export const getTransitionStartedAt = () => transitionStartedAt;

export interface TravelOptions {
  text?: string;
  style?: TransitionStyle;
  /** Hall spawn point when traveling to /hall. */
  spawn?: Spawn;
  /** Delay before the overlay covers the screen (lets an in-scene animation play). */
  delay?: number;
}

/**
 * Covers the screen with the lore transition, swaps the route under it, and
 * lets <TransitionController/> reveal the new scene once it reports ready.
 */
export async function travel(to: string, opts: TravelOptions = {}) {
  if (busy) return;
  busy = true;
  try {
    if (opts.delay) await wait(opts.delay);
    spawn = opts.spawn ?? 'entrance';
    transitionStartedAt = performance.now();
    ui().setSceneReady(false);
    ui().startTransition(opts.text ?? '', opts.style ?? 'fade');
    if (opts.style === 'glitch') sfx.glitch();
    else sfx.whoosh(0.25);
    if (document.pointerLockElement && opts.style === 'glitch') document.exitPointerLock();
    await wait(750);
    await router.navigate(to);
  } finally {
    busy = false;
  }
}

/** Marks a transition as started without navigating (direct loads, back button). */
export function beginTransition(text: string, style: TransitionStyle = 'fade') {
  transitionStartedAt = performance.now();
  ui().setSceneReady(false);
  ui().startTransition(text, style);
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
