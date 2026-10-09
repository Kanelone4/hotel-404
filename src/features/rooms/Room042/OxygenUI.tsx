import { useUI } from '@/stores/uiStore';
import { useRoom042 } from './state';

const SEGMENTS = 20;

/**
 * DOM overlay: oxygen gauge (top-left, under the location label), low-oxygen
 * edge pulse, and the blackout curtain when you run out.
 */
export function OxygenUI({ reducedMotion }: { reducedMotion: boolean }) {
  const o2 = useRoom042((s) => s.o2);
  const breathing = useRoom042((s) => s.breathing);
  const blackout = useRoom042((s) => s.blackout);
  const exiting = useUI((s) => s.exiting);
  const curtain = useUI((s) => s.transition.active);

  const pct = Math.round(o2 * 100);
  const low = o2 < 0.25;
  const lit = Math.ceil(o2 * SEGMENTS);
  const status = breathing ? 'surface · respirez' : low ? 'remontez' : o2 < 0.55 ? 'réserve' : 'apnée';
  const hidden = exiting || curtain;

  return (
    <>
      {/* Low-oxygen vignette */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${low && !hidden ? 'opacity-100' : 'opacity-0'} ${
          low && !reducedMotion ? 'animate-pulse' : ''
        }`}
        style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(40,0,8,0.55) 100%)' }}
      />

      <div
        className={`absolute top-12 left-4 w-48 font-mono text-[10px] tracking-[0.25em] uppercase transition-opacity duration-700 sm:top-14 sm:left-6 ${
          hidden ? 'opacity-0' : 'opacity-100'
        }`}
        aria-label={`Oxygène ${pct} %`}
      >
        <div className="flex items-baseline justify-between text-sage">
          <span>
            O<sub className="text-[8px]">2</sub>
          </span>
          <span className={`tabular-nums ${low ? 'text-neon' : breathing ? 'text-sage' : 'text-amber-soft'}`}>{pct}%</span>
        </div>
        <div className="mt-1.5 flex gap-[3px]">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 transition-colors duration-300 ${
                i < lit ? (low ? 'bg-neon' : breathing ? 'bg-sage' : 'bg-amber') : 'bg-sage-dim/30'
              }`}
            />
          ))}
        </div>
        <div className={`mt-1.5 text-[9px] ${low ? 'text-neon/90' : 'text-sage-dim'}`}>{status}</div>
      </div>

      {/* Blackout when the air runs out */}
      <div
        className={`absolute inset-0 bg-ink transition-opacity ${blackout ? 'opacity-100 duration-[1400ms]' : 'opacity-0 duration-[1800ms]'}`}
      />
    </>
  );
}
