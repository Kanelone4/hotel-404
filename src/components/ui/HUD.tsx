import { useEffect, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGame, ALL_FRAGMENTS } from '@/stores/gameStore';
import { useUI, ui } from '@/stores/uiStore';
import { ROOMS } from '@/features/rooms/registry';
import { travel } from '@/lib/motion/travel';
import { clearInput } from '@/lib/input/input';
import { requestLock, type SceneKey } from '@/features/hub/Experience';
import { MuteButton } from './MuteButton';

interface HUDProps {
  sceneKey: SceneKey;
  lockTarget: RefObject<HTMLElement>;
}

/** All DOM chrome drawn over the 3D view. */
export function HUD({ sceneKey, lockTarget }: HUDProps) {
  return (
    <div className="pointer-events-none absolute inset-0 font-mono text-paper">
      <Crosshair />
      <TopBar sceneKey={sceneKey} />
      <Hint />
      <Toast />
      <NoteModal />
      <RewardCard />
      <PauseMenu sceneKey={sceneKey} lockTarget={lockTarget} />
    </div>
  );
}

function Crosshair() {
  const label = useUI((s) => s.hoverLabel);
  const curtain = useUI((s) => s.transition.active);
  const isTouch = useUI((s) => s.isTouch);
  if (curtain) return null;
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <motion.div
        className="mx-auto rounded-full border border-paper/80"
        animate={{ width: label ? 22 : 5, height: label ? 22 : 5, opacity: label ? 1 : 0.6, backgroundColor: label ? 'rgba(217,164,65,0.15)' : 'rgba(236,228,210,0.8)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      />
      <AnimatePresence>
        {label && (
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink/70 px-2 py-1 text-xs tracking-wide text-amber-soft backdrop-blur-sm"
          >
            {label} <span className="text-sage">[{isTouch ? '✋' : 'E / clic'}]</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopBar({ sceneKey }: { sceneKey: SceneKey }) {
  const fragments = useGame((s) => s.fragments);
  const place = sceneKey === 'hall' ? 'HALL · RDC' : `CH. ${sceneKey}`;
  const sub = sceneKey === 'hall' ? null : ROOMS[sceneKey].name;
  return (
    <div className="safe-t safe-x absolute inset-x-0 top-0 flex items-start justify-between gap-3 pb-4 sm:p-6">
      <div className="min-w-0 truncate text-[11px] tracking-[0.25em] text-sage uppercase">
        <span className="text-amber">●</span> {place}
        {sub && <span className="hidden md:inline"> · {sub}</span>}
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex gap-1 sm:gap-1.5" aria-label={`${fragments.length} fragments sur 5`}>
          {ALL_FRAGMENTS.map((f) => {
            const has = fragments.includes(f);
            return (
              <span
                key={f}
                className={`grid h-7 w-5 place-items-center border text-xs sm:w-6 transition-colors duration-700 ${
                  has ? 'border-amber bg-amber/15 text-amber-soft' : 'border-sage-dim/60 text-sage-dim/60'
                }`}
              >
                {has ? f : '·'}
              </span>
            );
          })}
        </div>
        <MuteButton />
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            ui().setPaused(true);
          }}
          className="grid h-8 w-8 place-items-center border border-sage-dim/60 text-sage hover:border-amber hover:text-amber"
          aria-label="Menu"
        >
          ≡
        </button>
      </div>
    </div>
  );
}

function Hint() {
  const hint = useUI((s) => s.hint);
  const curtain = useUI((s) => s.transition.active);
  return (
    <AnimatePresence>
      {hint && !curtain && (
        <motion.p
          key={hint}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.5 }}
          className="absolute bottom-12 left-1/2 max-w-[90vw] -translate-x-1/2 text-center text-xs tracking-wider text-paper/85 [text-shadow:0_1px_6px_#000] sm:text-sm touch:top-[8.5rem] touch:bottom-auto touch:max-w-[min(90vw,34rem)]"
        >
          {hint}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function Toast() {
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => {
      if (useUI.getState().toast?.id === toast.id) useUI.setState({ toast: null });
    }, 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.p
          key={toast.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          className="absolute top-16 left-1/2 max-w-[90vw] -translate-x-1/2 border-l-2 touch:top-[11.5rem] border-amber bg-ink/80 px-4 py-2 text-sm text-paper backdrop-blur"
        >
          {toast.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

const NOTE_STYLES = {
  paper: 'bg-paper text-ink font-display rotate-[-1.5deg] shadow-2xl',
  child: 'bg-[#fdf6e3] text-[#2a4d8f] font-display italic rotate-[1deg] shadow-2xl',
  engraving: 'bg-[#2b2622] text-[#cbb89a] font-mono tracking-widest uppercase border border-[#57493c]',
  system: 'bg-ink text-neon font-mono border border-neon/50',
} as const;

function NoteModal() {
  const note = useUI((s) => s.note);
  const isTouch = useUI((s) => s.isTouch);
  useEffect(() => {
    if (!note) return;
    clearInput();
    const close = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') ui().showNote(null);
    };
    // Defer so the key that opened the note doesn't close it.
    const t = window.setTimeout(() => window.addEventListener('keydown', close), 150);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', close);
    };
  }, [note]);
  return (
    <AnimatePresence>
      {note && (
        <motion.div
          className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/55 p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            ui().showNote(null);
          }}
          role="dialog"
          aria-label={note.title ?? 'Note'}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`max-h-[85dvh] max-w-md overflow-y-auto px-6 py-8 sm:px-8 sm:py-10 ${NOTE_STYLES[note.variant ?? 'paper']}`}
          >
            {note.title && <p className="mb-4 font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">{note.title}</p>}
            <p className="text-lg leading-relaxed whitespace-pre-line sm:text-xl">{note.body}</p>
            <p className="mt-8 font-mono text-[10px] tracking-widest uppercase opacity-50">
              {isTouch ? 'Toucher pour fermer' : 'E / clic pour fermer'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RewardCard() {
  const reward = useUI((s) => s.reward);
  const count = useGame((s) => s.fragments.length);
  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          className="absolute inset-x-0 top-1/4 flex justify-center"
          initial={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] text-sage uppercase">Chambre {reward.room} · terminée</p>
            {reward.fragment ? (
              <>
                <p className="mt-4 font-display text-6xl font-light sm:text-8xl text-amber-soft drop-shadow-[0_0_30px_rgba(217,164,65,0.6)]">{reward.fragment}</p>
                <p className="mt-2 text-xs tracking-widest text-paper/80 uppercase">Fragment de clé obtenu · {count}/5</p>
                {count === 5 && <p className="flicker mt-4 text-xs tracking-widest text-neon uppercase">Un bouton s’est allumé dans l’ascenseur.</p>}
              </>
            ) : (
              <p className="mt-4 font-display text-3xl text-paper/80">Vous connaissez déjà cette chambre.</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PauseMenu({ sceneKey, lockTarget }: HUDProps) {
  const locked = useUI((s) => s.pointerLocked);
  const isTouch = useUI((s) => s.isTouch);
  const paused = useUI((s) => s.paused);
  const curtain = useUI((s) => s.transition.active);
  const ready = useUI((s) => s.sceneReady);
  const note = useUI((s) => s.note);
  const exiting = useUI((s) => s.exiting);
  const { reducedMotion, cameraSmoothing, setReducedMotion, setCameraSmoothing, reset } = useGame();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  const visible = ready && !curtain && !note && !exiting && (paused || (!isTouch && !locked));
  const resume = () => {
    ui().setPaused(false);
    requestLock(lockTarget.current);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-auto absolute inset-0 grid place-items-center overflow-y-auto bg-ink/60 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="my-auto w-full max-w-sm">
            <button
              type="button"
              autoFocus
              onClick={resume}
              className="group w-full border border-amber/70 py-5 text-left transition-colors hover:bg-amber/10"
            >
              <span className="block px-5 font-display text-2xl text-amber-soft sm:text-3xl">{isTouch ? 'Reprendre' : 'Cliquez pour entrer'}</span>
              {!isTouch && (
                <span className="mt-1 block px-5 text-[11px] tracking-wider text-sage">
                  ZQSD / WASD marcher · Souris regarder · E / clic interagir · C s’accroupir · Échap pause
                </span>
              )}
            </button>
            <div className="mt-6 space-y-1 text-sm">
              <Toggle label="Réduire les mouvements" value={reducedMotion} onChange={setReducedMotion} />
              <Toggle label="Lissage caméra" value={cameraSmoothing} onChange={setCameraSmoothing} />
            </div>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              {sceneKey !== 'hall' && sceneKey !== '404' && (
                <MenuLink
                  onClick={() => {
                    ui().setPaused(false);
                    void travel('/hall', { text: 'Vous reprenez l’ascenseur.', spawn: 'elevator' });
                  }}
                >
                  ← Retourner au hall
                </MenuLink>
              )}
              <MenuLink onClick={() => navigate('/lite')}>Version texte accessible</MenuLink>
              <MenuLink
                danger
                onClick={() => {
                  if (!confirmReset) return setConfirmReset(true);
                  setConfirmReset(false);
                  reset();
                  ui().setPaused(false);
                  navigate('/');
                }}
              >
                {confirmReset ? 'Vraiment ? Les fragments seront perdus. Confirmer' : 'Réinitialiser la progression'}
              </MenuLink>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between text-paper/80">
      {label}
      <input type="checkbox" className="h-4 w-4 accent-amber" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function MenuLink({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 text-left tracking-wide transition-colors ${danger ? 'text-neon/70 hover:text-neon' : 'text-sage hover:text-amber-soft'}`}
    >
      {children}
    </button>
  );
}
