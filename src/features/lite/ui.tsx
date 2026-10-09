import type { ReactNode } from 'react';

export interface Choice {
  id: string;
  label: string;
  /** Optional longer accessible name when the visible label is terse. */
  ariaLabel?: string;
  onSelect: () => void;
  /** Visually marks the main action (amber). */
  primary?: boolean;
}

/** Props every room scene receives from the shell. */
export interface SceneProps {
  /** Announce the outcome of an action in the shared live region. */
  say: (text: string) => void;
  /** Mark the room solved (shared progress) and announce the fragment. */
  solve: (text: string) => void;
  /** True if the fragment was already found (here or in the 3D version). */
  solved: boolean;
}

export const btnBase =
  'w-full min-h-11 border px-4 py-3 text-left font-mono text-sm leading-snug transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-amber-soft';
export const btnPrimary = 'border-amber text-amber-soft hover:bg-amber hover:text-ink';
export const btnQuiet = 'border-sage/60 text-paper hover:border-paper hover:bg-night';

/** Ordered list of actions — order is stable so screen-reader users can learn it. */
export function Choices({
  items,
  label = 'Que faites-vous ?',
}: {
  items: Choice[];
  label?: string;
}) {
  return (
    <section aria-label={label} className="mt-8">
      <h2 className="mb-3 font-mono text-xs tracking-[0.25em] text-sage uppercase">{label}</h2>
      <ol className="space-y-2">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={c.onSelect}
              aria-label={c.ariaLabel}
              className={`${btnBase} ${c.primary ? btnPrimary : btnQuiet}`}
            >
              {c.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-paper sm:text-lg">{children}</div>
  );
}

/** Quoted in-world writing (notes, carvings, drawings). */
export function Inscription({ children }: { children: ReactNode }) {
  return (
    <blockquote className="border-l-2 border-amber pl-4 font-display text-lg text-amber-soft italic">
      {children}
    </blockquote>
  );
}

/** Visually hidden but read by assistive tech. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
