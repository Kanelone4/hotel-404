import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { Player } from '@/features/hub/Player';
import { useRoom } from '@/features/rooms/useRoom';
import { RoomUI } from '@/features/rooms/RoomUI';
import { Ambient } from '@/lib/audio/Sound';
import { noise, wind, drone, sporadic, muffled } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { useQuality } from '@/lib/fx/quality';
import { useUI, ui } from '@/stores/uiStore';
import { BOUNDS, STATIC_COLLIDERS, BATH_DOOR_CLOSED, BATH_DOOR_OPEN, SPAWN, TUB } from './layout';
import { Architecture } from './Architecture';
import { Props } from './Props';
import { Bathroom } from './Bathroom';
import { Inscription } from './Inscription';
import { Flashlight } from './Flashlight';
import { Dust } from './Dust';
import { Bulb } from './Bulb';
import { Tension } from './Tension';
import { GradeEffect } from './Grade';
import { bulbState, flash } from './state';
import { sfx237 } from './audio';

/**
 * Chambre 237 — « Abandonnée ».
 * Pure tension: a dark L-shaped suite explored by torchlight.
 *
 * Puzzle: tear the bulging wallpaper above the mattress → read the carving
 * (only legible in the beam): « SOUS LA BAIGNOIRE » → push the bathroom door,
 * pry the tub apron off → take fragment 4.
 */

/** 0 nothing · 1 wallpaper torn · 2 carving read · 3 apron off · 4 fragment taken */
type Step = 0 | 1 | 2 | 3 | 4;

const HINTS: Record<Step, { after: number; text: string } | null> = {
  0: { after: 40, text: 'Au-dessus du matelas, le papier peint gondole. Comme s’il cachait quelque chose.' },
  1: { after: 20, text: 'Approchez la lampe du plâtre nu.' },
  2: { after: 30, text: 'La baignoire. Derrière la porte entrouverte.' },
  3: { after: 15, text: 'Quelque chose brille sous la baignoire.' },
  4: null,
};

export default function Room237() {
  const { complete, exiting } = useRoom('237');
  const { tier, reducedMotion, particles } = useQuality();
  const curtain = useUI((s) => s.transition.active);
  const isTouch = useUI((s) => s.isTouch);

  const [step, setStep] = useState<Step>(0);
  const [doorOpen, setDoorOpen] = useState(false);
  const [torchOn, setTorchOn] = useState(true);
  const [hush, setHush] = useState(false);
  const armed = !curtain;

  const colliders = useMemo(() => [...STATIC_COLLIDERS, doorOpen ? BATH_DOOR_OPEN : BATH_DOOR_CLOSED], [doorOpen]);

  const advance = (s: Step) => setStep((cur) => (s > cur ? s : cur));

  // Heavy silence: duck every ambient bed for a few seconds after a discovery.
  const hushTimer = useRef(0);
  const silence = (ms: number) => {
    setHush(true);
    window.clearTimeout(hushTimer.current);
    hushTimer.current = window.setTimeout(() => setHush(false), ms);
  };
  useEffect(() => () => window.clearTimeout(hushTimer.current), []);

  // ── Torch toggle (F) ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat) return;
      if (ui().note || ui().exiting) return;
      sfx237.torchClick();
      setTorchOn((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Touch: the same toggle as a HUD button (no F key on phones).
  useEffect(() => {
    if (!isTouch) return;
    ui().setRoomAction({
      label: 'Lampe',
      aria: torchOn ? 'Éteindre la lampe' : 'Allumer la lampe',
      active: torchOn,
      onPress: () => {
        if (ui().note || ui().exiting) return;
        sfx237.torchClick();
        setTorchOn((v) => !v);
      },
    });
  }, [isTouch, torchOn]);
  useEffect(() => () => ui().setRoomAction(null), []);

  // ── Puzzle callbacks ───────────────────────────────────────────────────
  const onTear = () => {
    advance(1);
    silence(4000);
  };
  const onRead = () => {
    advance(2);
    ui().showNote({
      variant: 'engraving',
      title: 'Gravé dans le plâtre',
      body: 'SOUS LA BAIGNOIRE\n\n| | | |',
    });
    silence(5000);
  };
  const onOpenApron = () => advance(3);
  const onTake = () => {
    if (step >= 4) return;
    advance(4);
    complete({ exitDelay: 4800 });
  };

  // ── Exit: torch dies, darkness, one last breath next to you ───────────
  useEffect(() => {
    if (!exiting) return;
    const ids = [window.setTimeout(() => sfx237.exhale(undefined, 0.8), 2100)];
    ui().setHint(null);
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [exiting]);

  useIdleHints(step, armed && !exiting, isTouch);

  // ── Post-processing ────────────────────────────────────────────────────
  const grade = useMemo(() => new GradeEffect(), []);
  useEffect(() => () => grade.dispose(), [grade]);
  const exitT = useRef(0);
  const caOffset = useMemo(() => (reducedMotion ? new Vector2(0.0006, 0.0004) : new Vector2(0.0022, 0.0016)), [reducedMotion]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    let gain = 0.95 + 0.07 * bulbState.level; // bulb-driven room flicker
    if (exiting) {
      exitT.current += dt;
      gain *= Math.max(0, 1 - Math.max(0, exitT.current - 1.1) / 0.8);
    }
    grade.set(gain, reducedMotion ? 0.045 : 0.07, reducedMotion ? 0 : (clock.elapsedTime * 7.3) % 1);
  });

  const amb = exiting || hush ? 0 : 1;

  return (
    <>
      <color attach="background" args={['#020202']} />
      <fog attach="fog" args={['#030303', 2, 13]} />
      <ambientLight intensity={0.035} color="#6e7f8f" />
      <hemisphereLight args={['#2a2f38', '#0b0805', 0.05]} />

      <Architecture reducedMotion={reducedMotion} />
      <Props />
      <Inscription torn={step >= 1} read={step >= 2} onTear={onTear} onRead={onRead} dead={exiting} />
      <Bathroom
        doorOpen={doorOpen}
        onOpenDoor={() => setDoorOpen(true)}
        knowsWhere={step >= 2}
        apronOpen={step >= 3}
        onOpenApron={onOpenApron}
        taken={step >= 4}
        onTake={onTake}
      />
      <Bulb dead={exiting} reducedMotion={reducedMotion} />

      <Player start={SPAWN} yaw={0} bounds={BOUNDS} colliders={colliders} speed={2.1} footsteps />
      <Flashlight on={torchOn} exiting={exiting} reducedMotion={reducedMotion} />
      <Dust count={Math.round(2600 * particles)} />
      <Tension armed={armed} exiting={exiting} step={step} />

      {/* Audio: room tone, wind through the boards, a drone under the floor, the building settling. */}
      <Ambient sound={noise({ color: 'brown', freq: 140, gain: 0.7 })} volume={0.3 * amb} fade={2.5} />
      <Ambient sound={muffled(wind({ base: 320, depth: 200, speed: 0.05, gain: 0.7 }), 900)} volume={0.32 * amb} fade={3} />
      <Ambient sound={drone({ freqs: [36.7, 38.9, 55], type: 'sawtooth', cutoff: 170, gain: 0.22, tremolo: 0.07 })} volume={0.4 * amb} fade={4} />
      <Ambient sound={sporadic(() => sfx.creak(randomCreakPos(), 0.22), { min: 9, max: 22 })} volume={1} />
      <Ambient sound={sporadic(() => sfx.drip([TUB.x0 + 0.4, 0.62, -2.4], 0.25), { min: 2.5, max: 7 })} volume={1} />

      <EffectComposer multisampling={tier === 'high' ? 4 : 0}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.75} luminanceSmoothing={0.2} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={caOffset} radialModulation modulationOffset={0.25} />
        <Vignette offset={0.12} darkness={0.95} />
        <primitive object={grade} dispose={null} />
      </EffectComposer>

      <RoomUI.In>
        <TorchBadge on={torchOn} hidden={isTouch} />
      </RoomUI.In>
    </>
  );
}

function randomCreakPos(): [number, number, number] {
  const spots: [number, number, number][] = [
    [-3.2, 2.6, 1.5],
    [1.8, 2.6, -2.8],
    [0, 0.05, 3.8],
    [-2.0, 0.05, -0.5],
    [4.3, 2.5, -0.6],
  ];
  return spots[Math.floor(Math.random() * spots.length)];
}

/** Hints after idle time on a step; cleared on unmount. */
function useIdleHints(step: Step, active: boolean, isTouch: boolean) {
  const since = useRef(0);
  const lastStep = useRef(step);
  const shown = useRef<string | null>(null);
  const introLeft = useRef(isTouch ? 0 : 7);

  useEffect(() => () => ui().setHint(null), []);

  useFrame((_, rawDt) => {
    if (!active) return;
    const dt = Math.min(rawDt, 0.05);
    if (step !== lastStep.current) {
      lastStep.current = step;
      since.current = 0;
    }
    if (!ui().note) since.current += dt;
    let text: string | null = null;
    if (introLeft.current > 0) {
      introLeft.current -= dt;
      text = 'F : allumer / éteindre la lampe';
    } else {
      const h = HINTS[step];
      if (h && since.current > h.after) text = h.text;
      if (flash.power < 0.05 && step === 1 && since.current > 8) text = `Il fait trop noir. Rallumez la lampe (${isTouch ? 'bouton Lampe' : 'F'}).`;
    }
    if (text !== shown.current) {
      shown.current = text;
      ui().setHint(text);
    }
  });
}

function TorchBadge({ on, hidden }: { on: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-[0.3em] text-amber-soft/50 uppercase">
      Lampe · {on ? 'allumée' : 'éteinte'} <span className="opacity-60">[F]</span>
    </div>
  );
}
