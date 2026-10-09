import { create } from 'zustand';

/**
 * Room 404 shared state.
 *
 * `R` is a mutable singleton read every frame (shaders, post-fx, audio, DOM
 * scramble loop) — never put it in React state. `useNarr` is the small
 * reactive part (which line is shown, key/door/finale flags) that the DOM and
 * a few 3D components subscribe to.
 */
export const R = {
  /** Smoothed global corruption 0..1 (drives every shader / effect / synth). */
  corruption: 0,
  /** Short-lived extra corruption (interactions, line changes). Decays to 0. */
  spike: 0,
  /** Room clock in seconds (only advances while the scene is live). */
  time: 0,
  /** Finale progress 0..1 (set by the cutscene timeline). */
  finale: 0,
  /** Triangles blown apart (cutscene), 0..1. */
  explode: 0,
  reduced: false,
  /** Current on-screen (possibly scrambled) text of each monologue line — mirrored on the 3D wall. */
  displayed: [] as string[],
  /** Room time at which a line "leaked" off the DOM panel (falls on the wall too). -1 = in place. */
  leakedAt: [] as number[],
  /** Bumped whenever `displayed` / `leakedAt` change, so the wall knows to redraw. */
  textVersion: 0,
};

export function resetR() {
  R.corruption = 0;
  R.spike = 0;
  R.time = 0;
  R.finale = 0;
  R.explode = 0;
  R.displayed = [];
  R.leakedAt = [];
  R.textVersion = 0;
}

/** Bumps the spike (glitch burst) — capped. */
export function spike(amount = 0.35) {
  R.spike = Math.min(1, R.spike + amount);
}

export interface Line {
  text: string;
  /** What the line rewrites itself into once the page is corrupted enough. */
  alt?: string;
}

/** Le Gérant's monologue. */
export const SCRIPT: Line[] = [
  { text: 'Ah. Vous l’avez trouvée.', alt: 'Ah. Elle vous a trouvé.' },
  {
    text: 'Personne ne trouve la 404. C’est même un peu son principe.',
    alt: 'Personne ne sort de la 404. C’est même un peu son principe.',
  },
  { text: 'Regardez autour de vous. Le lit, l’eau, la chaise, les dessins, le papier peint.' },
  {
    text: 'Je n’avais plus de place. Alors j’ai rangé toutes les chambres ici. En même temps.',
    alt: 'Je n’avais plus de place. Alors je vous ai rangé ici. En même temps.',
  },
  {
    text: 'Cinq fragments. Vous avez bien travaillé.',
    alt: 'Cinq fragments. Vous étiez le sixième.',
  },
  { text: 'Vous pensiez qu’on les ramassait pour ouvrir une porte.' },
  { text: 'C’est vous qu’on ramassait.', alt: 'C’est vous qu’on effaçait.' },
  {
    text: 'Cet hôtel ne tient debout que parce que quelqu’un le regarde.',
    alt: 'Cet hôtel ne tient debout que parce que vous le regardez.',
  },
  {
    text: 'La 404 n’a jamais été prévue. Elle n’a pas de murs. Elle emprunte les vôtres.',
    alt: 'La 404 n’a jamais été prévue. Elle emprunte vos murs. Vos yeux.',
  },
  {
    text: 'Vous sentez ? Elle s’efface. Le texte aussi. Moi aussi.',
    alt: 'Vous sentez ? Elle s’efface. Le texte aussi. Vous aussi.',
  },
  { text: 'La clé du hall. Vous l’avez depuis le début. Elle n’ouvre qu’une seule porte.' },
  {
    text: 'Partez maintenant. Sinon il faudra vous ranger avec le reste.',
    alt: 'Restez maintenant. Il reste de la place avec le reste.',
  },
  {
    text: 'Merci de votre séjour. Nous ne vous oublierons pas.',
    alt: 'Merci de votre séjour. Votre séjour n’a jamais existé.',
  },
];

/** Index of the line that makes the key appear / the line that names it. */
export const KEY_LINE = 9;
export const KEY_TALK_LINE = 10;

interface NarrState {
  /** Index of the last line shown (-1 = none yet). */
  index: number;
  keyVisible: boolean;
  keyTaken: boolean;
  /** Cutscene running. */
  finale: boolean;
  setIndex: (i: number) => void;
  showKey: () => void;
  takeKey: () => void;
  startFinale: () => void;
  reset: () => void;
}

export const useNarr = create<NarrState>()((set) => ({
  index: -1,
  keyVisible: false,
  keyTaken: false,
  finale: false,
  setIndex: (index) => set({ index }),
  showKey: () => set({ keyVisible: true }),
  takeKey: () => set({ keyTaken: true, keyVisible: true }),
  startFinale: () => set({ finale: true }),
  reset: () => set({ index: -1, keyVisible: false, keyTaken: false, finale: false }),
}));

export const narr = () => useNarr.getState();
