/**
 * Global input state, written by DOM listeners and read every frame by the
 * Player. Kept outside React on purpose: no re-renders on key presses.
 *
 * Keys use `KeyboardEvent.code` (physical position), so WASD on QWERTY and
 * ZQSD on AZERTY both work without any layout detection.
 */
export interface InputState {
  /** -1..1, forward is +1. */
  forward: number;
  /** -1..1, right is +1. */
  strafe: number;
  /** Jump / swim up. */
  up: boolean;
  /** Crouch / swim down. */
  down: boolean;
  sprint: boolean;
  /** Accumulated look delta in pixels since last frame (consumed by Player). */
  lookX: number;
  lookY: number;
  /** Joystick vector from touch controls (overrides keys when non-zero). */
  stick: { x: number; y: number };
}

export const input: InputState = {
  forward: 0,
  strafe: 0,
  up: false,
  down: false,
  sprint: false,
  lookX: 0,
  lookY: 0,
  stick: { x: 0, y: 0 },
};

const pressed = new Set<string>();

const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['Space'];
const DOWN = ['KeyC', 'ControlLeft', 'ControlRight'];
const SPRINT = ['ShiftLeft', 'ShiftRight'];

const any = (codes: string[]) => codes.some((c) => pressed.has(c));

function recompute() {
  input.forward = (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0);
  input.strafe = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  input.up = any(UP);
  input.down = any(DOWN);
  input.sprint = any(SPRINT);
}

type Listener = () => void;
const interactListeners = new Set<Listener>();

/** Subscribe to the "interact" action (click while locked, E key, touch button). */
export function onInteract(fn: Listener) {
  interactListeners.add(fn);
  return () => {
    interactListeners.delete(fn);
  };
}

export function triggerInteract() {
  interactListeners.forEach((fn) => fn());
}

/** Gameplay keys we swallow so the page never scrolls. */
const SWALLOW = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT, ...UP]);

let installed = false;

/** Installs the global listeners once. Safe to call many times. */
export function installInput() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (SWALLOW.has(e.code) && document.pointerLockElement) e.preventDefault();
    pressed.add(e.code);
    recompute();
    if (e.code === 'KeyE' && !e.repeat) triggerInteract();
  });
  window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
    recompute();
  });
  window.addEventListener('blur', () => {
    pressed.clear();
    recompute();
  });
  window.addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    input.lookX += e.movementX;
    input.lookY += e.movementY;
  });
}

/** Resets transient movement (e.g. when a note opens). */
export function clearInput() {
  pressed.clear();
  recompute();
  input.lookX = 0;
  input.lookY = 0;
  input.stick.x = 0;
  input.stick.y = 0;
}
