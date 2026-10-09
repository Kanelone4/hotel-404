import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { input, triggerInteract } from '@/lib/input/input';
import { useUI } from '@/stores/uiStore';

/**
 * Mobile controls:
 *  - virtual joystick (bottom-left) to move,
 *  - drag anywhere else to look; a quick tap interacts with what the crosshair targets,
 *  - ✋ interact, ▲ / ▼ (jump/swim up · crouch/swim down), optional room action,
 *  - optional gyroscope look, and a soft "rotate your phone" prompt in portrait.
 * Everything respects the notch / home-indicator safe areas.
 */
export function TouchControls() {
  const isTouch = useUI((s) => s.isTouch);
  const curtain = useUI((s) => s.transition.active);
  const note = useUI((s) => s.note);
  const paused = useUI((s) => s.paused);
  const hover = useUI((s) => s.hoverLabel);
  const action = useUI((s) => s.roomAction);

  // Release held inputs whenever the controls disappear.
  const hidden = !isTouch || curtain || !!note || paused;
  useEffect(() => {
    if (!hidden) return;
    input.stick.x = 0;
    input.stick.y = 0;
    input.up = false;
    input.down = false;
  }, [hidden]);

  if (!isTouch) return null;
  return (
    // The wrapper never catches events itself (the HUD top bar stays tappable); children opt in.
    <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hidden ? 'invisible opacity-0' : ''}`}>
      <LookPad />
      <Joystick />
      <div
        className="pointer-events-auto absolute flex flex-col items-center gap-3"
        style={{
          right: 'max(1.25rem, env(safe-area-inset-right))',
          bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
        }}
      >
        {action && (
          <button
            type="button"
            aria-label={action.aria}
            aria-pressed={action.active}
            onPointerDown={(e) => {
              e.stopPropagation();
              action.onPress();
            }}
            className={`h-11 min-w-11 rounded-full border px-3 font-mono text-[11px] tracking-widest uppercase backdrop-blur ${
              action.active ? 'border-amber bg-amber/20 text-amber-soft' : 'border-paper/30 bg-ink/40 text-paper/70'
            }`}
          >
            {action.label}
          </button>
        )}
        <HoldButton label="▲" onChange={(v) => (input.up = v)} aria="Monter" />
        <HoldButton label="▼" onChange={(v) => (input.down = v)} aria="S'accroupir / descendre" />
        <button
          type="button"
          aria-label="Interagir"
          onPointerDown={(e) => {
            e.stopPropagation();
            triggerInteract();
          }}
          className={`h-16 w-16 rounded-full border-2 text-xl backdrop-blur transition-colors ${
            hover ? 'border-amber bg-amber/25 text-amber-soft' : 'border-paper/40 bg-ink/40 text-paper/60'
          }`}
        >
          ✋
        </button>
      </div>
      <GyroToggle />
      <RotatePrompt />
    </div>
  );
}

const JOY_R = 48;

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) {
      dx = (dx / d) * JOY_R;
      dy = (dy / d) * JOY_R;
    }
    setKnob({ x: dx, y: dy });
    // Small dead zone so a resting thumb doesn't drift.
    const k = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
    input.stick.x = k(dx / JOY_R);
    input.stick.y = k(-dy / JOY_R);
  };
  const end = () => {
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    input.stick.x = 0;
    input.stick.y = 0;
  };

  return (
    <div
      ref={base}
      className="pointer-events-auto absolute h-32 w-32 touch-none rounded-full border border-paper/25 bg-ink/30 backdrop-blur-sm"
      style={{
        left: 'max(1.25rem, env(safe-area-inset-left))',
        bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        pid.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => pid.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-hidden
    >
      <div
        className="absolute top-1/2 left-1/2 h-12 w-12 rounded-full border border-amber/70 bg-amber/20"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

/** Full-screen look surface (below the HUD top bar). A short tap = interact. */
function LookPad() {
  const touches = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>());
  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 top-16 touch-none"
      onPointerDown={(e) => {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const l = touches.current.get(e.pointerId);
        if (!l) return;
        input.lookX += (e.clientX - l.x) * 1.7;
        input.lookY += (e.clientY - l.y) * 1.7;
        l.x = e.clientX;
        l.y = e.clientY;
      }}
      onPointerUp={(e) => {
        const l = touches.current.get(e.pointerId);
        touches.current.delete(e.pointerId);
        if (!l) return;
        const moved = Math.hypot(e.clientX - l.sx, e.clientY - l.sy);
        if (moved < 10 && performance.now() - l.t < 280) triggerInteract();
      }}
      onPointerCancel={(e) => touches.current.delete(e.pointerId)}
    />
  );
}

function HoldButton({ label, onChange, aria }: { label: string; onChange: (v: boolean) => void; aria: string }) {
  return (
    <button
      type="button"
      aria-label={aria}
      className="h-11 w-11 touch-none rounded-full border border-paper/30 bg-ink/40 text-paper/70 backdrop-blur active:border-amber active:text-amber"
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
    >
      {label}
    </button>
  );
}

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

function GyroToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    let prev: { a: number; b: number } | null = null;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return;
      if (prev) {
        let da = e.alpha - prev.a;
        if (da > 180) da -= 360;
        if (da < -180) da += 360;
        input.lookX -= da * 8;
        input.lookY -= (e.beta - prev.b) * 8;
      }
      prev = { a: e.alpha, b: e.beta };
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [on]);

  if (typeof DeviceOrientationEvent === 'undefined') return null;
  return (
    <button
      type="button"
      className={`pointer-events-auto absolute border px-2 py-1 font-mono text-[10px] tracking-widest uppercase ${on ? 'border-amber text-amber' : 'border-paper/30 text-paper/50'}`}
      style={{ top: 'calc(max(1rem, env(safe-area-inset-top)) + 2.75rem)', right: 'max(1rem, env(safe-area-inset-right))' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={async () => {
        const D = DeviceOrientationEvent as unknown as OrientationPermission;
        if (!on && D.requestPermission) {
          try {
            if ((await D.requestPermission()) !== 'granted') return;
          } catch {
            return;
          }
        }
        setOn(!on);
      }}
    >
      Gyro {on ? 'on' : 'off'}
    </button>
  );
}

/** Portrait works (FOV adapts), but landscape is the intended frame — suggest it once. */
function RotatePrompt() {
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('hotel-404:portrait-ok') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('hotel-404:portrait-ok', '1');
    } catch {
      /* ignored */
    }
  };
  return (
    <AnimatePresence>
      {portrait && !dismissed && (
        <motion.div
          className="pointer-events-auto absolute inset-0 z-10 grid place-items-center bg-ink/85 p-8 text-center backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div>
            <motion.div
              className="mx-auto h-16 w-10 rounded-md border-2 border-amber/80"
              animate={{ rotate: [0, -90, -90, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.8, 1] }}
            />
            <p className="mt-6 font-display text-2xl text-paper">Tournez votre téléphone</p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-sage uppercase">L’hôtel se visite à l’horizontale</p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-8 min-h-11 border border-sage-dim px-5 font-mono text-[11px] tracking-widest text-sage uppercase"
            >
              Continuer en portrait
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
