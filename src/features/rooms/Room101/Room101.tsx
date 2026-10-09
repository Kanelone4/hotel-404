import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { BackSide, Vector2, type HemisphereLight, type DirectionalLight, type Mesh, type MeshBasicMaterial } from 'three';
import { Player } from '@/features/hub/Player';
import { player, yawForward } from '@/features/hub/playerState';
import { useRoom } from '@/features/rooms/useRoom';
import { Ambient } from '@/lib/audio/Sound';
import { wind, muffled } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { useQuality } from '@/lib/fx/quality';
import { useUI, ui } from '@/stores/uiStore';
import { Architecture } from './Architecture';
import { Bed, Nightstand, ToyChest, Wardrobe } from './Furniture';
import { NightLight } from './NightLight';
import { Ball, Blocks, HiddenTeddy, ReturningTeddy, RockingHorse, Train } from './Toys';
import { DecoDrawings, Photo404, PuzzleDrawings } from './Drawings';
import { MusicBox } from './MusicBox';
import { createMusicBox, roomTone } from './audio';
import { fx, resetFx } from './state';
import { BED, BOUNDS, COLLIDERS, DOUDOU_HIDE, HX, HZ, MUSIC_BOX, PHOTO, SPAWN, WARDROBE } from './layout';

type Phase = 'search' | 'puzzle' | 'solved' | 'taken';

const START_TURNS = [3, 2, 1];

const CHILD_NOTE = `Si tu trouves Nounours, rends-le moi.
Je peux pas dormir sans lui.

Et remets mes dessins dans le bon sens.
Sinon la porte reste ouverte.
Celle du bout du couloir. Celle qui existe pas.

— Léo, 6 ans (bientôt 7)`;

/**
 * Chambre 101 — « Chambre d'enfant ».
 * Nostalgia, then unease. Find the teddy under the bed (crouch), turn the
 * three drawings upright to read « LA CHAMBRE 404 EXISTE », take fragment "0"
 * from the music box. After the teddy is taken, the room changes behind your back.
 */
export default function Room101() {
  const { complete, exiting } = useRoom('101');
  const { tier, reducedMotion, heavyFx } = useQuality();
  const curtain = useUI((s) => s.transition.active);
  const [phase, setPhase] = useState<Phase>('search');
  const [turns, setTurns] = useState<number[]>(START_TURNS);
  const ctl = useMemo(() => createMusicBox(), []);
  const idle = useRef(0);

  // Fresh per-frame state on every visit.
  useMemo(() => resetFx(reducedMotion), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fx.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  const takeTeddy = useCallback(() => {
    if (phase !== 'search') return;
    sfx.slide([DOUDOU_HIDE[0], 0.1, DOUDOU_HIDE[2]], 0.3);
    setPhase('puzzle');
    idle.current = 0;
    fx.uneaseOn = true;
    ui().showNote({ variant: 'child', body: CHILD_NOTE });
  }, [phase]);

  const turnSheet = useCallback(
    (i: number) => {
      if (phase !== 'puzzle') return;
      idle.current = 0;
      sfx.slide([(i - 1) * 0.56, 1.5, -HZ], 0.12);
      setTurns((t) => t.map((v, k) => (k === i ? v + 1 : v)));
    },
    [phase],
  );

  // Solved — wait for the last sheet to settle before the reveal.
  useEffect(() => {
    if (phase !== 'puzzle' || !turns.every((v) => v % 4 === 0)) return;
    const id = window.setTimeout(() => {
      fx.solved = true;
      setPhase('solved');
      idle.current = 0;
      sfx.glitch(PHOTO, 0.35);
      sfx.click([MUSIC_BOX[0], MUSIC_BOX[1] + 0.1, MUSIC_BOX[2]], 0.5);
      ctl.rate = Math.max(ctl.rate, 0.95);
      ui().showToast('« LA CHAMBRE 404 EXISTE ». Quelque part, un couvercle s’ouvre.');
    }, 650);
    return () => window.clearTimeout(id);
  }, [turns, phase, ctl]);

  const takeFragment = useCallback(() => {
    if (phase !== 'solved') return;
    setPhase('taken');
    complete({ exitDelay: 4200 });
  }, [phase, complete]);

  // Exit: the music box stops dead, then the night-light dies.
  useEffect(() => {
    if (!exiting) return;
    ctl.kill();
    sfx.click([MUSIC_BOX[0], MUSIC_BOX[1] + 0.05, MUSIC_BOX[2]], 0.4);
  }, [exiting, ctl]);

  useEffect(() => () => ui().setHint(null), []);

  // ── Per-frame: unease clock, music box drift, creaks, hints, blackout ──
  const creakIn = useRef(10);
  const lastHint = useRef<string | null>(null);
  const hemi = useRef<HemisphereLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const isTouch = useUI((s) => s.isTouch);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { note } = ui();
    const running = !curtain && !note;

    if (exiting) fx.dying = Math.min(1, fx.dying + dt / 1.4);

    if (fx.uneaseOn && running && !exiting) {
      fx.unease += dt;
      // The spring unwinds: slower, flatter, wobblier.
      const u = Math.min(1, Math.max(0, (fx.unease - 5) / 90));
      ctl.rate = phase === 'solved' ? Math.max(0.85, 1 - 0.32 * u) : 1 - 0.32 * u;
      ctl.pitch = 1 - 0.035 * u + Math.sin(clock.elapsedTime * 0.7) * 0.004 * u;
      ctl.wobble = 0.004 + 0.03 * u;

      // Creaks somewhere you're not looking.
      creakIn.current -= dt;
      if (creakIn.current <= 0 && fx.unease > 5) {
        creakIn.current = 9 + Math.random() * 12;
        const f = yawForward(player.yaw);
        const spots: [number, number, number][] = [
          [player.position.x - f.x * 1.6, 0.2, player.position.z - f.z * 1.6],
          [WARDROBE.x0, 1.2, (WARDROBE.z0 + WARDROBE.z1) / 2],
          [BED.x1, 0.5, (BED.z0 + BED.z1) / 2],
        ];
        const s = spots[Math.floor(Math.random() * spots.length)];
        s[0] = Math.max(-HX + 0.2, Math.min(HX - 0.2, s[0]));
        s[2] = Math.max(-HZ + 0.2, Math.min(HZ - 0.2, s[2]));
        sfx.creak(s, 0.22 + Math.random() * 0.15);
      }
    }

    const alive = 1 - fx.dying;
    if (hemi.current) hemi.current.intensity = 0.32 * alive;
    if (moon.current) moon.current.intensity = 0.35 * alive;

    // Contextual hints after idle time.
    if (running) idle.current += dt;
    let hint: string | null = null;
    if (!curtain && !exiting) {
      const t = idle.current;
      if (phase === 'search') {
        if (player.crouching) hint = null;
        else if (t > 45) hint = isTouch ? 'Accroupissez-vous avec ▼ pour regarder sous le lit' : 'C ou Ctrl pour vous accroupir — regardez sous le lit';
        else if (t > 22) hint = 'Les enfants cachent toujours quelque chose sous leur lit…';
      } else if (phase === 'puzzle' && t > 14) {
        hint = isTouch ? 'Les trois dessins au-dessus du coffre : visez-en un, puis ✋ pour le tourner' : 'Les trois dessins au-dessus du coffre : cliquez pour les tourner';
      } else if (phase === 'solved' && t > 8) {
        hint = 'La boîte à musique s’est ouverte.';
      }
    }
    if (hint !== lastHint.current) {
      lastHint.current = hint;
      ui().setHint(hint);
    }
  });

  return (
    <>
      <color attach="background" args={['#06070c']} />
      <fog attach="fog" args={['#0a0b12', 4, 11]} />
      <hemisphereLight ref={hemi} args={['#8fa3d6', '#2a2024', 0.32]} />
      <directionalLight ref={moon} position={[-4, 3.2, 1.6]} intensity={0.35} color="#9fb6ff" />

      <Architecture />
      <Bed />
      <Nightstand />
      <Wardrobe />
      <ToyChest />
      <NightLight heavy={heavyFx} />

      {phase === 'search' && <HiddenTeddy onTake={takeTeddy} />}
      {phase !== 'search' && <ReturningTeddy />}
      <Blocks />
      <Train />
      <Ball />
      <RockingHorse />

      <PuzzleDrawings turns={turns} enabled={phase !== 'search'} solved={phase === 'solved' || phase === 'taken'} onTurn={turnSheet} />
      <DecoDrawings />
      <Photo404 heavy={heavyFx} />
      <MusicBox ctl={ctl} open={phase === 'solved' || phase === 'taken'} taken={phase === 'taken'} onTake={takeFragment} />

      <Blackout />

      <Player start={SPAWN} yaw={0} bounds={BOUNDS} colliders={COLLIDERS} speed={2.2} crouchHeight={0.62} />

      <Ambient sound={roomTone} volume={0.3} />
      <Ambient sound={muffled(wind({ base: 320, depth: 180, speed: 0.05, gain: 0.7 }), 900)} volume={0.22} />

      <EffectComposer multisampling={tier === 'high' ? 4 : 0}>
        <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.78} luminanceSmoothing={0.25} />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={reducedMotion ? CA_NONE : CA_SOFT}
          radialModulation
          modulationOffset={0.45}
        />
        <Noise opacity={0.06} premultiply blendFunction={BlendFunction.SCREEN} />
        <Vignette offset={0.22} darkness={0.82} />
      </EffectComposer>
    </>
  );
}

const CA_SOFT = new Vector2(0.0007, 0.0005);
const CA_NONE = new Vector2(0, 0);

/** Black shell around the camera, faded in during the exit: darkness swallows the room. */
function Blackout() {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  useFrame(({ camera }) => {
    if (!mesh.current || !mat.current) return;
    const o = Math.max(0, (fx.dying - 0.25) / 0.75);
    mesh.current.visible = o > 0;
    mesh.current.position.copy(camera.position);
    mat.current.opacity = o;
  });
  return (
    <mesh ref={mesh} visible={false} renderOrder={999} frustumCulled={false}>
      <sphereGeometry args={[0.3, 16, 12]} />
      <meshBasicMaterial ref={mat} color="#000" side={BackSide} transparent opacity={0} depthTest={false} depthWrite={false} fog={false} />
    </mesh>
  );
}
