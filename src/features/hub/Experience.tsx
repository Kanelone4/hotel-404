import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace } from 'three';
import { AudioRig } from '@/lib/audio/AudioRig';
import { InteractionSystem } from '@/lib/interaction/InteractionSystem';
import { installInput, triggerInteract } from '@/lib/input/input';
import { ROOMS, isRoomId } from '@/features/rooms/registry';
import { RoomUI } from '@/features/rooms/RoomUI';
import { HUD } from '@/components/ui/HUD';
import { TouchControls } from '@/components/ui/TouchControls';
import { useGame } from '@/stores/gameStore';
import { ui, useUI } from '@/stores/uiStore';
import { beginTransition } from '@/lib/motion/travel';
import { setTitle } from '@/lib/motion/useTitleEasterEgg';
import { player } from './playerState';
import { installDebug } from '@/lib/debug';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { ResponsiveFov, view } from '@/lib/fx/fov';
import type { RoomId } from '@/types/game';

const Hall = lazy(() => import('./Hall'));

export type SceneKey = 'hall' | RoomId;

/**
 * Layout route for /hall and /room/:id. Owns the single persistent <Canvas>
 * so the WebGL context survives every scene change (no context loss, warm
 * shader cache, seamless transitions).
 */
export default function Experience() {
  const { pathname } = useLocation();
  const { id } = useParams();
  const unlocked = useGame((s) => s.room404Unlocked);
  const wrapper = useRef<HTMLDivElement>(null);
  // Phones: start lower (fill-rate bound, post-FX heavy) and let PerformanceMonitor adjust.
  const maxDpr = ui().isTouch ? 1.5 : 1.75;
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, ui().isTouch ? 1.15 : 1.5));

  const sceneKey: SceneKey | null = pathname.startsWith('/hall')
    ? 'hall'
    : isRoomId(id)
      ? id
      : null;

  useEffect(() => {
    installInput();
    installDebug();
    const onLock = () => ui().setPointerLocked(document.pointerLockElement === wrapper.current);
    document.addEventListener('pointerlockchange', onLock);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  // Direct loads / back-forward navigation: make sure the lore curtain covers the swap.
  useEffect(() => {
    if (!sceneKey) return;
    if (!ui().transition.active) {
      const def = sceneKey === 'hall' ? null : ROOMS[sceneKey];
      beginTransition(
        def ? def.loadingText : 'Le hall s’allume, une ampoule après l’autre…',
        def?.enterStyle === 'glitch' ? 'glitch' : 'fade',
      );
    }
    setTitle(sceneKey === 'hall' ? 'Hall — Hôtel 404' : `Chambre ${sceneKey} — Hôtel 404`);
  }, [sceneKey]);

  if (!sceneKey) return <Navigate to="/hall" replace />;
  if (sceneKey === '404' && !unlocked) return <Deny404 />;

  const onPointerDown = () => {
    const s = ui();
    if (s.isTouch || s.transition.active) return;
    if (s.note) {
      s.showNote(null);
      return;
    }
    if (!s.pointerLocked) requestLock(wrapper.current);
    else triggerInteract();
  };

  return (
    <div ref={wrapper} className="fixed inset-0 bg-ink select-none" onPointerDown={onPointerDown}>
      <Canvas
        className="!absolute inset-0"
        shadows
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 70, near: 0.05, far: 200, position: [0, 1.6, 8] }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <PerformanceMonitor
          flipflops={3}
          onIncline={() => setDpr(Math.min(window.devicePixelRatio, maxDpr))}
          onDecline={() => setDpr(ui().isTouch ? 0.85 : 1)}
          onFallback={() => setDpr(1)}
        />
        <AudioRig />
        <InteractionSystem />
        <ResponsiveFov />
        <SceneHost sceneKey={sceneKey} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <RoomUI.Out />
      </div>
      <HUD sceneKey={sceneKey} lockTarget={wrapper} />
      <TouchControls />
    </div>
  );
}

function Deny404() {
  useEffect(() => ui().showToast('La chambre 404 n’existe pas.'), []);
  return <Navigate to="/hall" replace />;
}

export function requestLock(el: HTMLElement | null) {
  if (!el || ui().isTouch) return;
  try {
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {
      /* Chrome refuses re-lock for ~1s after Esc; the next click retries. */
    });
  } catch {
    /* ignored */
  }
}

function SceneHost({ sceneKey }: { sceneKey: SceneKey }) {
  const Scene = sceneKey === 'hall' ? Hall : ROOMS[sceneKey].Scene;
  const camera = useThree((s) => s.camera);

  // Every scene starts from the same camera defaults; rooms may override.
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    view.baseFov = 70;
    cam.fov = 70;
    cam.near = 0.05;
    cam.far = 200;
    cam.zoom = 1;
    cam.updateProjectionMatrix();
    player.roll = 0;
    player.controlsCamera = true;
    player.movementEnabled = true;
  }, [sceneKey, camera]);

  return (
    <SceneErrorBoundary sceneKey={sceneKey}>
      <Suspense key={sceneKey} fallback={null}>
        <Scene />
        <SceneReady />
      </Suspense>
    </SceneErrorBoundary>
  );
}

/** Mounted after the scene's Suspense resolves: precompiles shaders then reports ready. */
function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // Timers, not rAF: rAF never fires in a background tab, which would leave the curtain down forever.
    const t1 = window.setTimeout(() => {
      try {
        gl.compile(scene, camera);
      } catch {
        /* non-fatal */
      }
    }, 0);
    const t2 = window.setTimeout(() => ui().setSceneReady(true), 60);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [gl, scene, camera]);
  return null;
}

/** Re-export for scenes that need to know if the curtain is still down. */
export const useCurtain = () => useUI((s) => s.transition.active);
