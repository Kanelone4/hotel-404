import { useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '@/stores/gameStore';
import { unlockAudio } from '@/lib/audio/engine';
import { sfx } from '@/lib/audio/sfx';
import { travel } from '@/lib/motion/travel';
import { hasWebGL2 } from '@/lib/fx/quality';
import { setTitle } from '@/lib/motion/useTitleEasterEgg';
import { useDomReady } from '@/lib/motion/useDomReady';
import { MuteButton } from '@/components/ui/MuteButton';

const LINES = [
  'Un hôtel qui n’apparaît sur aucune carte.',
  'Les chambres changent quand on ne les regarde pas.',
  'Le personnel vous attendait.',
];

/** 2D animated welcome screen. The "Entrer" click is the gesture that unlocks audio. */
export function Intro() {
  useDomReady();
  const [params] = useSearchParams();
  const sharedRoom = params.get('room');
  const fragments = useGame((s) => s.fragments.length);
  const visited = useGame((s) => s.visitedRooms.length);
  const ending = useGame((s) => s.endingSeen);
  const reset = useGame((s) => s.reset);
  const webgl = useMemo(hasWebGL2, []);
  const [line, setLine] = useState(0);

  useEffect(() => setTitle('Hôtel 404'), []);
  useEffect(() => {
    const id = window.setInterval(() => setLine((l) => (l + 1) % LINES.length), 3800);
    return () => window.clearInterval(id);
  }, []);

  // Mouse parallax on the layered sign.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const backX = useTransform(sx, (v) => v * -18);
  const backY = useTransform(sy, (v) => v * -12);
  const frontX = useTransform(sx, (v) => v * 10);
  const frontY = useTransform(sy, (v) => v * 8);

  const enter = async () => {
    // Phones: go fullscreen + landscape when the browser allows it (Android Chrome; iOS ignores).
    if (window.matchMedia('(pointer: coarse)').matches) void goImmersive();
    await unlockAudio();
    sfx.ding(undefined, 0.5);
    void travel('/hall', { text: 'Le portier vous fait signe d’avancer…', style: 'fade', spawn: 'entrance' });
  };

  const hasSave = visited > 0;

  return (
    <main
      className="grain relative flex h-full flex-col overflow-x-hidden overflow-y-auto bg-ink text-paper"
      style={{ touchAction: 'pan-y' }}
      onPointerMove={(e) => {
        mx.set(e.clientX / window.innerWidth - 0.5);
        my.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      {/* Ambient glow layers */}
      <motion.div style={{ x: backX, y: backY }} className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-[15%] left-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 rounded-full bg-amber/10 blur-[90px]" />
        <div className="absolute right-[10%] bottom-[5%] h-[40vmin] w-[40vmin] rounded-full bg-deep/60 blur-[100px]" />
        <Corridor />
      </motion.div>

      <header className="safe-t safe-x relative z-10 flex items-center justify-between pb-3 font-mono sm:p-8 text-[11px] tracking-[0.3em] text-sage uppercase">
        <span>Est. 19██ · ★★★☆☆</span>
        <MuteButton />
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div style={{ x: frontX, y: frontY }}>
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.8em' }}
            animate={{ opacity: 1, letterSpacing: '0.45em' }}
            transition={{ duration: 2.2, ease: 'easeOut' }}
            className="font-mono text-xs text-sage uppercase"
          >
            Bienvenue à
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.6, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-4 font-display text-[clamp(3rem,min(16vw,22dvh),12rem)] leading-[0.85] font-light"
          >
            Hôtel <span className="flicker text-amber-soft drop-shadow-[0_0_40px_rgba(217,164,65,0.45)]">404</span>
          </motion.h1>
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mt-4 h-6 font-sans text-sm text-paper/70 sm:mt-6 sm:text-lg"
          >
            {LINES[line]}
          </motion.p>
        </motion.div>

        {sharedRoom === '404' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="mt-8 max-w-md border border-neon/40 px-4 py-3 font-mono text-xs leading-relaxed text-neon"
          >
            Quelqu’un vous a envoyé vers la chambre 404.
            <br />
            Elle n’existe pas. Pas encore.
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="mt-6 flex flex-col items-center gap-3 sm:mt-12 sm:gap-4"
        >
          {webgl ? (
            <>
              <button
                type="button"
                onClick={enter}
                className="group relative min-h-12 overflow-hidden border border-amber px-14 py-3 font-mono sm:py-4 text-sm tracking-[0.4em] text-amber-soft uppercase transition-colors hover:text-ink"
              >
                <span className="absolute inset-0 -translate-x-full bg-amber transition-transform duration-500 ease-out group-hover:translate-x-0" />
                <span className="relative">{hasSave ? 'Reprendre' : 'Entrer'}</span>
              </button>
              {hasSave && (
                <p className="font-mono text-[11px] tracking-widest text-sage">
                  {fragments}/5 fragments · {visited} chambre{visited > 1 ? 's' : ''} visitée{visited > 1 ? 's' : ''}
                  {ending && ' · vous êtes déjà allé au bout'}
                  {' · '}
                  <button type="button" onClick={reset} className="underline decoration-dotted hover:text-neon">
                    recommencer
                  </button>
                </p>
              )}
              <p className="max-w-xs font-mono text-[10px] leading-relaxed tracking-widest text-sage-dim uppercase">
                Casque recommandé · Le son s’active en entrant
              </p>
            </>
          ) : (
            <p className="max-w-sm border border-neon/50 p-4 font-mono text-xs leading-relaxed text-neon">
              Votre navigateur ne supporte pas WebGL2. L’hôtel ne peut pas se matérialiser ici.
              <br />
              Essayez une version récente de Chrome, Firefox, Safari ou Edge.
            </p>
          )}
          <a href="/lite" className="font-mono text-[11px] tracking-widest text-sage underline decoration-dotted hover:text-amber-soft">
            Version texte accessible
          </a>
        </motion.div>
      </section>

      <footer className="safe-x relative z-10 flex justify-between gap-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] font-mono text-[10px] tracking-[0.25em] text-sage-dim uppercase sm:p-8">
        <span>Réception ouverte 24/7</span>
        <span>Check-out : jamais</span>
      </footer>
    </main>
  );
}

async function goImmersive() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* not supported / refused — portrait still works */
  }
}

/** Perspective corridor drawn in SVG — receding door frames that slowly breathe. */
function Corridor() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.22]" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 9 }, (_, i) => {
        const s = Math.pow(0.72, i);
        const w = 900 * s;
        const h = 1100 * s;
        return (
          <motion.rect
            key={i}
            x={500 - w / 2}
            y={560 - h / 2}
            width={w}
            height={h}
            fill="none"
            stroke={i === 5 ? '#d9a441' : '#8fa89a'}
            strokeWidth={1.2}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 6, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        );
      })}
    </svg>
  );
}
