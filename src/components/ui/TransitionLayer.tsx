import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI, ui } from '@/stores/uiStore';
import { useGame } from '@/stores/gameStore';
import { getTransitionStartedAt } from '@/lib/motion/travel';
import { sfx } from '@/lib/audio/sfx';

const MIN_VISIBLE: Record<string, number> = { fade: 1300, elevator: 2600, glitch: 1800 };

/**
 * Global curtain shown between scenes. Ends automatically once the incoming
 * scene reports `sceneReady` and the minimum duration has elapsed — the
 * loading time is hidden behind the lore animation.
 */
export function TransitionLayer() {
  const { active, text, style } = useUI((s) => s.transition);
  const ready = useUI((s) => s.sceneReady);
  const reducedMotion = useGame((s) => s.reducedMotion);

  useEffect(() => {
    if (!active || !ready) return;
    const elapsed = performance.now() - getTransitionStartedAt();
    const t = window.setTimeout(
      () => {
        ui().endTransition();
        ui().setExiting(false);
        ui().setReward(null);
        if (style === 'elevator') sfx.ding();
      },
      Math.max(0, (MIN_VISIBLE[style] ?? 1300) - elapsed),
    );
    return () => window.clearTimeout(t);
  }, [active, ready, style]);

  // Elevator rides rumble while the curtain is down.
  useEffect(() => {
    if (active && style === 'elevator') sfx.rumble(0.45, 2.4);
  }, [active, style]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="curtain"
          className="fixed inset-0 z-50 overflow-hidden"
          initial={{ opacity: style === 'elevator' ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: style === 'elevator' ? 1 : 0 }}
          transition={{ duration: style === 'elevator' ? 0.01 : 0.7 }}
          aria-live="polite"
        >
          {style === 'elevator' ? (
            <ElevatorCurtain text={text} reducedMotion={reducedMotion} />
          ) : style === 'glitch' ? (
            <GlitchCurtain text={text} />
          ) : (
            <div className="grain absolute inset-0 grid place-items-center bg-ink">
              <p className="flicker max-w-md px-6 text-center font-mono text-sm tracking-widest text-sage uppercase">{text}</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ElevatorCurtain({ text, reducedMotion }: { text: string; reducedMotion: boolean }) {
  const door = 'absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,#3b3f3c,#6b706b_40%,#505550_60%,#2e322f)]';
  const [floor, setFloor] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFloor((f) => (f + 1 + Math.floor(Math.random() * 3)) % 1000), 140);
    return () => window.clearInterval(id);
  }, []);
  return (
    <motion.div
      className="absolute inset-0"
      animate={reducedMotion ? {} : { x: [0, -2, 2, -1, 1, 0], y: [0, 1, -1, 2, 0] }}
      transition={{ duration: 0.35, repeat: Infinity }}
    >
      <motion.div className={`${door} left-0 border-r border-black/60`} initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.75, ease: [0.6, 0, 0.2, 1] }} />
      <motion.div className={`${door} right-0 border-l border-black/60`} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.75, ease: [0.6, 0, 0.2, 1] }} />
      <motion.div
        className="absolute inset-0 grid place-items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.6 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      >
        <div className="text-center">
          <div className="mx-auto mb-6 w-28 border border-black/50 bg-black/80 py-2 font-mono text-3xl text-neon shadow-[0_0_25px_rgba(255,79,94,0.35)]">
            ▲ {String(floor).padStart(3, '0')}
          </div>
          <p className="max-w-sm px-6 font-mono text-xs tracking-[0.25em] text-black/70 uppercase">{text}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GlitchCurtain({ text }: { text: string }) {
  const [slices, setSlices] = useState<number[]>([]);
  useEffect(() => {
    const id = window.setInterval(() => setSlices(Array.from({ length: 6 }, () => Math.random())), 90);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 bg-black">
      {slices.map((r, i) => (
        <div
          key={i}
          className="absolute inset-x-0 bg-neon/20 mix-blend-screen"
          style={{ top: `${r * 100}%`, height: `${2 + r * 8}px`, transform: `translateX(${(r - 0.5) * 60}px)` }}
        />
      ))}
      <div className="absolute inset-0 grid place-items-center">
        <p className="relative font-mono text-lg tracking-widest text-paper uppercase" data-text={text}>
          <span className="absolute inset-0 translate-x-[3px] text-neon/80 mix-blend-screen">{text}</span>
          <span className="absolute inset-0 -translate-x-[3px] text-cyan-400/70 mix-blend-screen">{text}</span>
          {text}
        </p>
      </div>
    </div>
  );
}
