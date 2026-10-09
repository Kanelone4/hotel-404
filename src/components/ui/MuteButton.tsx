import { useGame } from '@/stores/gameStore';

export function MuteButton({ className = '' }: { className?: string }) {
  const muted = useGame((s) => s.muted);
  const toggle = useGame((s) => s.toggleMute);
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      className={`grid h-8 w-8 place-items-center border border-sage-dim/60 text-sage hover:border-amber hover:text-amber ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none" />
        {muted ? <path d="M11 5.5l4 5M15 5.5l-4 5" /> : <path d="M11.5 5a4 4 0 010 6M13.5 3a7 7 0 010 10" />}
      </svg>
    </button>
  );
}
