import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { sfx } from '@/lib/audio/sfx';
import { useUI, ui } from '@/stores/uiStore';
import { LAMP_LIGHT, KEY_PILLOW, NIGHTSTAND } from './layout';

/** Discrete puzzle state (drives React). */
export interface R1State {
  lampOn: boolean;
  drawerOpen: boolean;
  drawerEverOpened: boolean;
  noteRead: boolean;
  /** Increments each time the pillow is lifted (Bed animates on change). */
  pillowNonce: number;
  keyRevealed: boolean;
  keyTaken: boolean;
}

/**
 * Continuous levels, tweened by GSAP and read every frame by the scene
 * (never trigger React renders).
 *  lamp    — 0 off … 1 on (filament warm-up / decay)
 *  flicker — multiplier for uncanny stutters
 *  exit    — 0 … 1 room fades to black while leaving
 */
export interface Levels {
  lamp: number;
  flicker: number;
  exit: number;
}

export interface R1 {
  s: R1State;
  levels: Levels;
  toggleLamp: () => void;
  toggleDrawer: () => void;
  readNote: () => void;
  liftPillow: () => void;
  takeKey: () => void;
}

const Ctx = createContext<R1 | null>(null);
export const Room001Provider = Ctx.Provider;

export function useR1(): R1 {
  const v = useContext(Ctx);
  if (!v) throw new Error('useR1 must be used inside <Room001Provider>');
  return v;
}

const NIGHTSTAND_AT: [number, number, number] = [NIGHTSTAND.x + 0.2, NIGHTSTAND.h - 0.1, NIGHTSTAND.z];

/** Puzzle state machine for Chambre 001. */
export function useRoom001(opts: { complete: (o: { exitDelay: number }) => void; exiting: boolean }): R1 {
  const [s, setS] = useState<R1State>({
    lampOn: true,
    drawerOpen: false,
    drawerEverOpened: false,
    noteRead: false,
    pillowNonce: 0,
    keyRevealed: false,
    keyTaken: false,
  });
  const levels = useMemo<Levels>(() => ({ lamp: 1, flicker: 1, exit: 0 }), []);
  const sRef = useRef(s);
  sRef.current = s;
  const completeRef = useRef(opts.complete);
  completeRef.current = opts.complete;

  useEffect(() => () => void gsap.killTweensOf(levels), [levels]);

  const toggleLamp = useCallback(() => {
    if (ui().exiting) return;
    const on = !sRef.current.lampOn;
    sfx.click(LAMP_LIGHT, 0.45);
    gsap.killTweensOf(levels, 'lamp');
    if (on) {
      // Incandescent: a tiny hesitation before it settles.
      gsap
        .timeline()
        .to(levels, { lamp: 0.55, duration: 0.05, ease: 'none' })
        .to(levels, { lamp: 0.25, duration: 0.06, ease: 'none' })
        .to(levels, { lamp: 1, duration: 0.35, ease: 'power2.out' });
    } else {
      // Filament afterglow.
      gsap.to(levels, { lamp: 0, duration: 0.45, ease: 'expo.out' });
    }
    setS((p) => ({ ...p, lampOn: on }));
  }, [levels]);

  const toggleDrawer = useCallback(() => {
    sfx.slide(NIGHTSTAND_AT, 0.35);
    setS((p) => ({ ...p, drawerOpen: !p.drawerOpen, drawerEverOpened: true }));
  }, []);

  const readNote = useCallback(() => {
    ui().showNote({ body: 'Vous n’auriez pas dû monter.', variant: 'paper' });
    if (!sRef.current.noteRead) setS((p) => ({ ...p, noteRead: true }));
  }, []);

  const liftPillow = useCallback(() => {
    const cur = sRef.current;
    const reveal = cur.noteRead && !cur.lampOn && !cur.keyRevealed;
    sfx.slide(KEY_PILLOW, 0.12);
    if (reveal) {
      sfx.whoosh(0.12);
    } else if (!cur.keyRevealed) {
      window.setTimeout(() => {
        if (!sRef.current.noteRead) ui().showToast('Rien. Un creux tiède dans l’oreiller, comme si quelqu’un venait de se lever.');
        else ui().showToast('Rien. Il fait peut-être trop clair pour voir.');
      }, 450);
    }
    setS((p) => ({ ...p, pillowNonce: p.pillowNonce + 1, keyRevealed: p.keyRevealed || reveal }));
  }, []);

  const takeKey = useCallback(() => {
    if (sRef.current.keyTaken || ui().exiting) return;
    setS((p) => ({ ...p, keyTaken: true }));
    completeRef.current({ exitDelay: 3600 });
  }, []);

  // ── Uncanny nudge: after the note is closed the lamp stutters by itself ──
  const note = useUI((st) => st.note);
  const nudged = useRef(false);
  useEffect(() => {
    if (note || !s.noteRead || nudged.current || !s.lampOn) return;
    nudged.current = true;
    const id = window.setTimeout(() => {
      sfx.click(LAMP_LIGHT, 0.15);
      gsap
        .timeline()
        .to(levels, { flicker: 0.15, duration: 0.04 })
        .to(levels, { flicker: 1, duration: 0.05 })
        .to(levels, { flicker: 0.35, duration: 0.03, delay: 0.12 })
        .to(levels, { flicker: 1, duration: 0.2 });
    }, 1400);
    return () => window.clearTimeout(id);
  }, [note, s.noteRead, s.lampOn, levels]);

  // ── Exit effect: lamp sputters, then the room sinks into darkness ──
  useEffect(() => {
    if (!opts.exiting) return;
    const tl = gsap.timeline({ delay: 0.6 });
    tl.to(levels, { flicker: 0.1, duration: 0.05 })
      .to(levels, { flicker: 1, duration: 0.06 })
      .to(levels, { flicker: 0.2, duration: 0.04, delay: 0.25 })
      .to(levels, { flicker: 0.8, duration: 0.05 })
      .call(() => sfx.click(LAMP_LIGHT, 0.4), [], '+=0.35')
      .to(levels, { flicker: 0, duration: 0.15 })
      .to(levels, { exit: 1, duration: 1.6, ease: 'power2.in' }, '<');
    return () => void tl.kill();
  }, [opts.exiting, levels]);

  return useMemo(
    () => ({ s, levels, toggleLamp, toggleDrawer, readNote, liftPillow, takeKey }),
    [s, levels, toggleLamp, toggleDrawer, readNote, liftPillow, takeKey],
  );
}

/** Contextual hints — only when relevant, cleared on unmount. */
export function useRoom001Hints(s: R1State) {
  const curtain = useUI((st) => st.transition.active);
  const note = useUI((st) => st.note);
  const exiting = useUI((st) => st.exiting);
  const [elapsed, setElapsed] = useState(0);
  const noteReadAt = useRef<number | null>(null);

  useEffect(() => () => ui().setHint(null), []);

  // Coarse clock (seconds since the curtain lifted).
  useEffect(() => {
    if (curtain) return;
    const t0 = performance.now();
    const id = window.setInterval(() => setElapsed(Math.floor((performance.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [curtain]);

  if (s.noteRead && noteReadAt.current === null && !note) noteReadAt.current = elapsed;

  let hint: string | null = null;
  if (curtain || exiting || note || s.keyTaken) hint = null;
  else if (s.keyRevealed) hint = null;
  else if (s.noteRead && !s.lampOn) hint = 'Quelque chose luit, près de l’oreiller.';
  else if (s.noteRead && s.lampOn) {
    const since = elapsed - (noteReadAt.current ?? elapsed);
    hint = since >= 5 ? 'Certaines choses ne se voient que dans le noir.' : null;
  } else if (!s.drawerEverOpened) {
    if (elapsed >= 3 && elapsed < 10) hint = 'Une chambre normale. Prenez le temps de regarder.';
    else if (elapsed >= 35) hint = 'La table de chevet a un tiroir.';
  }

  useEffect(() => {
    ui().setHint(hint);
  }, [hint]);
}
