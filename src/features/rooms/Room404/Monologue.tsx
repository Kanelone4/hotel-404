import { useEffect, useRef, useState } from 'react';
import { R, SCRIPT, useNarr } from './state';

/**
 * DOM side of the corruption: le Gérant's monologue, typed line by line, that
 * rewrites itself (characters scramble into other words), leaks off-screen
 * (lines fall out of the viewport, ghost duplicates, skew) and is joined by
 * fake HUD elements. Text is written imperatively (textContent) from a single
 * 50 ms loop — React only manages which lines exist. Whatever is on screen is
 * also published to R.displayed so the 3D wall mirrors it.
 */
const GLYPHS = '█▓▒░#@$%&*<>/\\|01_¤§ΞΔ¿?!';
const rg = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

interface LineState {
  base: string;
  alt?: string;
  /** Text the line currently "means". */
  target: string;
  shown: number;
  morph: null | { from: string; to: string; start: number; dur: number; resolve: number[] };
  glitches: Map<number, { ch: string; until: number }>;
  leaked: boolean;
  last: string;
}

const CPS = 32; // typing speed, chars / s

export function Monologue({ reduced }: { reduced: boolean }) {
  const index = useNarr((s) => s.index);
  const finale = useNarr((s) => s.finale);
  const panel = useRef<HTMLDivElement>(null);
  const leakLayer = useRef<HTMLDivElement>(null);
  const sigRef = useRef<HTMLSpanElement>(null);
  const els = useRef<(HTMLParagraphElement | null)[]>([]);
  const lines = useRef<LineState[]>([]);
  const finaleRef = useRef(false);
  finaleRef.current = finale;

  // Register newly revealed lines.
  useEffect(() => {
    for (let i = lines.current.length; i <= index && i < SCRIPT.length; i++) {
      const l = SCRIPT[i];
      lines.current.push({
        base: l.text,
        alt: l.alt,
        target: l.text,
        shown: 0,
        morph: null,
        glitches: new Map(),
        leaked: false,
        last: '',
      });
      R.leakedAt[i] = -1;
    }
  }, [index]);

  useEffect(() => {
    let last = performance.now();
    let sigMorph = 0;
    const leak = (i: number, mode: 'fall' | 'ghost') => {
      const el = els.current[i];
      const layer = leakLayer.current;
      if (!el || !layer) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        margin: '0',
        willChange: 'transform, opacity',
        transition: reduced
          ? 'opacity 2.4s ease, transform 2.4s ease'
          : `transform ${1.6 + Math.random() * 1.8}s cubic-bezier(.55,0,.9,.4), opacity 2.5s ease`,
      } satisfies Partial<CSSStyleDeclaration>);
      if (mode === 'ghost') {
        const dx = (Math.random() - 0.5) * 18;
        clone.style.transition = 'opacity 0.7s ease';
        clone.style.transform = `translate(${dx}px, ${(Math.random() - 0.5) * 6}px) skewX(${(Math.random() - 0.5) * 20}deg)`;
        clone.style.color = Math.random() < 0.5 ? '#ff4f5e' : '#4fe3ff';
        clone.style.mixBlendMode = 'screen';
        clone.style.opacity = '0.8';
      }
      layer.appendChild(clone);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (mode === 'ghost') clone.style.opacity = '0';
          else if (reduced) {
            clone.style.opacity = '0';
            clone.style.transform = 'translateY(40px)';
          } else {
            const dx = (Math.random() - 0.5) * 300;
            clone.style.transform = `translate(${dx}px, 115vh) rotate(${(Math.random() - 0.5) * 50}deg) skewX(${(Math.random() - 0.5) * 40}deg)`;
            clone.style.opacity = '0.35';
          }
        });
      });
      window.setTimeout(() => clone.remove(), 4000);
      if (mode === 'fall') {
        el.style.visibility = 'hidden';
        lines.current[i].leaked = true;
        R.leakedAt[i] = R.time;
        R.textVersion++;
      }
    };

    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const c = Math.min(1, R.corruption + R.spike * 0.4);
      const ls = lines.current;
      const newest = ls.length - 1;
      let changed = false;

      ls.forEach((l, i) => {
        const el = els.current[i];
        if (!el) return;
        // Typing.
        if (l.shown < l.target.length) l.shown = Math.min(l.target.length, l.shown + CPS * dt);
        const typing = l.shown < l.target.length;

        // Rewrite: the line scrambles into its alternate wording (and back).
        if (!typing && !l.morph && l.alt && i < newest && c > 0.32 && Math.random() < 0.006 * c) {
          const to = l.target === l.base ? l.alt : l.base;
          const len = Math.max(l.target.length, to.length);
          l.morph = {
            from: l.target,
            to,
            start: now,
            dur: reduced ? 2600 : 1400,
            resolve: Array.from({ length: len }, () => 0.15 + Math.random() * 0.85),
          };
        }

        let s: string;
        if (l.morph) {
          const m = l.morph;
          const p = (now - m.start) / m.dur;
          const len = m.resolve.length;
          let out = '';
          for (let k = 0; k < len; k++) {
            const r = m.resolve[k];
            if (p >= r) out += m.to[k] ?? '';
            else if (p >= r * 0.35) out += rg();
            else out += m.from[k] ?? '';
          }
          s = out;
          if (p >= 1) {
            l.target = m.to;
            l.shown = m.to.length;
            l.morph = null;
            s = m.to;
          }
        } else {
          s = l.target.slice(0, Math.floor(l.shown));
        }

        // Character glitches (brief random glyphs).
        if (!typing && Math.random() < c * (reduced ? 0.12 : 0.5)) {
          const n = 1 + ((Math.random() * (1 + c * 4)) | 0);
          for (let k = 0; k < n; k++)
            l.glitches.set((Math.random() * s.length) | 0, {
              ch: rg(),
              until: now + 80 + Math.random() * 260,
            });
        }
        if (l.glitches.size) {
          const arr = s.split('');
          l.glitches.forEach((g, pos) => {
            if (g.until < now) l.glitches.delete(pos);
            else if (pos < arr.length && arr[pos] !== ' ') arr[pos] = g.ch;
          });
          s = arr.join('');
        }
        const display = typing ? s + '▌' : s;
        if (display !== l.last) {
          l.last = display;
          el.textContent = display;
          R.displayed[i] = s;
          changed = true;
        }

        // Leaks: older lines fall out of the page; ghosts duplicate.
        if (!l.leaked && i < newest - 2 && c > 0.4 && Math.random() < 0.004 * c) leak(i, 'fall');
        else if (!l.leaked && !reduced && c > 0.25 && Math.random() < 0.01 * c) leak(i, 'ghost');
      });

      // Finale: everything falls at once.
      if (finaleRef.current)
        ls.forEach((l, i) => !l.leaked && Math.random() < 0.15 && leak(i, 'fall'));

      // Signature rewrites itself.
      if (sigRef.current) {
        if (c > 0.6 && Math.random() < 0.01) sigMorph = now;
        const t = now - sigMorph;
        sigRef.current.textContent =
          t < 1600
            ? t < 300 || t > 1300
              ? `— ${rg()}${rg()}${rg()}${rg()}`
              : '— vous'
            : '— le Gérant';
      }

      // Panel skew / slip on spikes.
      if (panel.current) {
        const sk = reduced
          ? 0
          : R.spike * 10 * (Math.random() - 0.5) +
            (Math.random() < c * 0.05 ? (Math.random() - 0.5) * 12 : 0);
        const tx = reduced ? 0 : Math.random() < c * 0.06 ? (Math.random() - 0.5) * 40 : 0;
        panel.current.style.transform = `translateX(${tx}px) skewX(${sk}deg)`;
        panel.current.style.opacity = finaleRef.current ? '0' : '1';
      }
      if (changed) R.textVersion++;
    }, 50);
    return () => window.clearInterval(id);
  }, [reduced]);

  const visible = SCRIPT.slice(0, Math.max(0, index + 1));

  return (
    <>
      <div
        ref={panel}
        className="absolute bottom-24 left-4 max-w-[min(30rem,calc(100vw-2rem))] font-mono text-paper transition-opacity duration-1000 sm:left-8 touch:landscape:right-28 touch:landscape:bottom-5 touch:landscape:left-44 touch:landscape:max-w-none touch:portrait:top-28 touch:portrait:bottom-auto touch:portrait:right-4"
        aria-live="polite"
      >
        <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[0.3em] text-neon uppercase">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon" /> canal 404
          · réception
        </div>
        <div className="space-y-2 border-l border-neon/40 bg-black/45 py-3 pr-4 pl-4 text-[13px] leading-relaxed backdrop-blur-[2px] sm:text-sm">
          {visible.map((l, i) => (
            <p
              key={i}
              ref={(el) => {
                els.current[i] = el;
              }}
              className={i === visible.length - 1 ? 'text-paper' : 'text-paper/70'}
              style={{ textShadow: '1px 0 rgba(255,79,94,.45), -1px 0 rgba(79,227,255,.35)' }}
              aria-label={l.text}
            />
          ))}
          <p className="pt-1 text-right text-[11px] tracking-[0.2em] text-sage">
            <span ref={sigRef}>— le Gérant</span>
          </p>
        </div>
      </div>
      <div
        ref={leakLayer}
        className="pointer-events-none fixed inset-0 overflow-hidden font-mono text-[13px] text-paper sm:text-sm"
      />
      <FakeHud reduced={reduced} />
    </>
  );
}

type FakeKind = 'toast' | 'counter' | 'progress' | 'label' | 'dialog' | 'hint' | 'error';
interface Fake {
  id: number;
  kind: FakeKind;
  x: number;
  y: number;
  born: number;
  life: number;
  text: string;
}

const FAKE_TEXT: Record<FakeKind, string[]> = {
  toast: [
    'La chambre 404 n’existe pas.',
    'Le bouton refuse. Il manque 1 fragment de vous.',
    'Tout est normal. Tout est normal.',
  ],
  counter: ['6 / 5', '5 / 4', '0 / 0'],
  progress: ['Suppression du client', 'Rangement du client', 'Check-out forcé'],
  label: ['Sortir', 'Se réveiller', 'Ouvrir les yeux', 'Annuler'],
  dialog: ['hotel404.exe ne répond pas.', 'Le client a cessé de répondre.'],
  hint: ['ZQSD pour… pour…', 'Il n’y a rien à viser.', 'Cliquez pour oublier'],
  error: ['ERR_ROOM_NOT_FOUND', 'Uncaught Guest: undefined', 'segfault @ 0x404', 'NaN NaN NaN NaN'],
};
const KINDS = Object.keys(FAKE_TEXT) as FakeKind[];

/** Fake HUD elements popping in as the page corrupts. */
function FakeHud({ reduced }: { reduced: boolean }) {
  const [fakes, setFakes] = useState<Fake[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let id = 0;
    const t = window.setInterval(() => {
      const c = Math.min(1, R.corruption + R.spike * 0.3);
      const n = performance.now();
      setNow(n);
      setFakes((fs) => {
        let next = fs.filter((f) => n - f.born < f.life);
        if (
          c > 0.2 &&
          Math.random() < c * (reduced ? 0.12 : 0.3) &&
          next.length < (reduced ? 2 : 6)
        ) {
          const kind = KINDS[(Math.random() * KINDS.length) | 0];
          const pool = FAKE_TEXT[kind];
          next = [
            ...next,
            {
              id: ++id,
              kind,
              x: 8 + Math.random() * 70,
              y: 8 + Math.random() * 70,
              born: n,
              life: (reduced ? 3500 : 1200) + Math.random() * 2600,
              text: pool[(Math.random() * pool.length) | 0],
            },
          ];
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(t);
  }, [reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden font-mono">
      {fakes.map((f) => {
        const age = (now - f.born) / f.life;
        const jitter = reduced ? 0 : (Math.random() - 0.5) * 6;
        const style = {
          left: `${f.x}%`,
          top: `${f.y}%`,
          opacity: reduced
            ? Math.min(1, Math.min(age * 4, (1 - age) * 4))
            : Math.random() < 0.1
              ? 0.3
              : 1,
          transform: `translateX(${jitter}px)`,
          transition: reduced ? 'opacity .4s' : undefined,
        };
        switch (f.kind) {
          case 'toast':
            return (
              <div
                key={f.id}
                style={style}
                className="absolute rounded-sm border border-paper/10 bg-ink/80 px-4 py-2 text-xs tracking-wide text-paper"
              >
                {f.text}
              </div>
            );
          case 'counter':
            return (
              <div key={f.id} style={style} className="absolute flex gap-1.5">
                {f.text.split('').map((ch, k) => (
                  <span
                    key={k}
                    className="grid h-7 w-6 place-items-center border border-amber bg-amber/15 text-xs text-amber-soft"
                  >
                    {ch === ' ' ? '·' : ch}
                  </span>
                ))}
              </div>
            );
          case 'progress': {
            const pct = Math.min(99, Math.floor(age * 140));
            return (
              <div
                key={f.id}
                style={style}
                className="absolute w-56 border border-neon/50 bg-black/70 p-2 text-[10px] tracking-widest text-neon uppercase"
              >
                {f.text}… {pct}%
                <div className="mt-1 h-1 bg-neon/20">
                  <div className="h-full bg-neon" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }
          case 'label':
            return (
              <div key={f.id} style={style} className="absolute">
                <div className="mx-auto h-[22px] w-[22px] rounded-full border border-paper/80 bg-amber/15" />
                <p className="mt-2 rounded-sm bg-ink/70 px-2 py-1 text-xs whitespace-nowrap text-amber-soft">
                  {f.text} <span className="text-sage">[E / clic]</span>
                </p>
              </div>
            );
          case 'dialog':
            return (
              <div
                key={f.id}
                style={style}
                className="absolute w-64 border border-paper/30 bg-[#c9c9c9] text-[11px] text-black shadow-[4px_4px_0_#000]"
              >
                <div className="bg-[#0a246a] px-2 py-0.5 text-white">Hôtel 404</div>
                <p className="px-3 py-3">{f.text}</p>
                <div className="flex justify-end gap-2 px-3 pb-2">
                  <span className="border border-black/60 bg-[#ddd] px-3">Attendre</span>
                  <span className="border border-black/60 bg-[#ddd] px-3">Attendre</span>
                </div>
              </div>
            );
          case 'hint':
            return (
              <div
                key={f.id}
                style={style}
                className="absolute rounded-full bg-ink/70 px-4 py-2 text-xs text-sage"
              >
                {f.text}
              </div>
            );
          default:
            return (
              <div key={f.id} style={style} className="absolute text-[11px] text-neon">
                {f.text}
              </div>
            );
        }
      })}
    </div>
  );
}
