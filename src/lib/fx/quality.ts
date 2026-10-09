import { useMemo } from 'react';
import { useUI } from '@/stores/uiStore';
import { useGame } from '@/stores/gameStore';

export type Tier = 'high' | 'low';

/** Rough device tier: touch devices and low-core machines get the light path. */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'high';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || cores <= 4 ? 'low' : 'high';
}

/**
 * Rooms read this to scale their post-processing and particle counts.
 *   const { tier, reducedMotion, particles } = useQuality();
 */
export function useQuality() {
  const isTouch = useUI((s) => s.isTouch);
  const reducedMotion = useGame((s) => s.reducedMotion);
  return useMemo(() => {
    const tier = isTouch ? 'low' : detectTier();
    return {
      tier,
      reducedMotion,
      /** Multiplier for particle counts. */
      particles: tier === 'high' ? 1 : 0.4,
      /** Whether expensive effects (DOF, godrays, SSAO) should run. */
      heavyFx: tier === 'high',
    };
  }, [isTouch, reducedMotion]);
}

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
