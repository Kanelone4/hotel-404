import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { Player } from './Player';
import { player } from './playerState';
import { Elevator, type FloorButton } from './Elevator';
import { Architecture } from './hall/Architecture';
import { Reception } from './hall/Reception';
import { Lounge } from './hall/Lounge';
import { Paintings } from './hall/Paintings';
import { Lamps } from './hall/Lamps';
import { HallChanges } from './hall/HallChanges';
import { HALL, HALL_BOUNDS, STATIC_COLLIDERS, DOOR_COLLIDER, SPAWN_ENTRANCE, SPAWN_ELEVATOR, CABIN_CENTER_Z } from './hall/layout';
import { Ambient } from '@/lib/audio/Sound';
import { noise, drone } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { getSpawn, travel } from '@/lib/motion/travel';
import { useQuality } from '@/lib/fx/quality';
import { useGame, ALL_FRAGMENTS, game } from '@/stores/gameStore';
import { useUI, ui } from '@/stores/uiStore';
import { ROOMS } from '@/features/rooms/registry';

const DEAD_LINES: Record<string, string> = {
  '000': 'L’étage 000 n’existe pas (pour l’instant).',
  '777': 'Le 777 est réservé. Pas pour vous.',
  SS: 'Le sous-sol est inondé. Revenez plus tard.',
  '∞': 'Le bouton est chaud. Rien ne se passe. Pour l’instant.',
};

/** The lobby: the calm airlock before the strange. */
export default function Hall() {
  const spawnAt = useMemo(getSpawn, []);
  const curtain = useUI((s) => s.transition.active);
  const unlocked = useGame((s) => s.room404Unlocked);
  const done = useGame((s) => s.completedRooms);
  const { tier, reducedMotion } = useQuality();
  const [departing, setDeparting] = useState(false);
  const [nearElevator, setNearElevator] = useState(spawnAt === 'elevator');
  const shake = useRef(0);

  const fromElevator = spawnAt === 'elevator';
  const start = fromElevator ? SPAWN_ELEVATOR : SPAWN_ENTRANCE;
  const yaw = fromElevator ? Math.PI : 0;

  // Doors: open when you approach, closed while the curtain is down or when leaving.
  const doorsOpen = !curtain && !departing && nearElevator;
  const colliders = useMemo(() => (doorsOpen ? STATIC_COLLIDERS : [...STATIC_COLLIDERS, DOOR_COLLIDER]), [doorsOpen]);

  const prevOpen = useRef(doorsOpen);
  useEffect(() => {
    if (doorsOpen && !prevOpen.current) sfx.ding([0, 2.4, HALL.back], 0.35);
    if (prevOpen.current !== doorsOpen) sfx.slide([0, 1.2, HALL.back], 0.25);
    prevOpen.current = doorsOpen;
  }, [doorsOpen]);

  useHints(fromElevator);

  useFrame(({ camera }, dt) => {
    const p = player.position;
    const near = p.z < HALL.back + 4.2 && Math.abs(p.x) < 3.2;
    if (near !== nearElevator) setNearElevator(near);

    // Departure shake, applied on top of the Player's camera write.
    if (shake.current > 0 && !reducedMotion) {
      shake.current = Math.max(0, shake.current - dt * 0.6);
      const a = shake.current * 0.012;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
  });

  const onPress = (b: FloorButton) => {
    if (departing) return;
    const at: [number, number, number] = [HALL.cabinHalf, 1.25, CABIN_CENTER_Z + 0.55];
    if (b.kind === 'dead') {
      sfx.buzz(at);
      ui().showToast(DEAD_LINES[b.label] ?? 'Rien.');
      return;
    }
    if (b.room === '404' && !game().room404Unlocked) {
      const missing = ALL_FRAGMENTS.length - game().fragments.length;
      sfx.buzz(at);
      ui().showToast(`Le bouton refuse. Il manque ${missing} fragment${missing > 1 ? 's' : ''} de clé.`);
      return;
    }
    if (!b.room) return;
    const def = ROOMS[b.room];
    // Must be inside the cabin to depart.
    if (player.position.z > HALL.back - 0.3) {
      ui().showToast('Entrez dans la cabine d’abord.');
      return;
    }
    setDeparting(true);
    player.movementEnabled = false;
    sfx.ding(at, 0.5);
    shake.current = 1;
    if (document.pointerLockElement && def.enterStyle === 'glitch') document.exitPointerLock();
    void travel(`/room/${def.id}`, {
      text: def.loadingText,
      style: def.enterStyle === 'glitch' ? 'glitch' : 'elevator',
      delay: 1100,
    });
  };

  return (
    <>
      <color attach="background" args={['#0b0f0e']} />
      <fog attach="fog" args={[unlocked ? '#1a0b0c' : '#0b0f0e', 12, 34]} />
      <hemisphereLight args={[unlocked ? '#ffb0a0' : '#ffe2b8', '#1c2420', 0.35]} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[3, 6, 4]} intensity={0.25} color="#ffd9a0" />

      <Architecture />
      <Reception />
      <Lounge />
      <Paintings />
      <Lamps flicker={done.includes('237') ? 3 : null} tint={unlocked} />
      <HallChanges />
      <Elevator open={doorsOpen} onPress={onPress} departing={departing} />

      <Player start={start} yaw={yaw} bounds={HALL_BOUNDS} colliders={colliders} speed={2.8} />

      <Ambient sound={noise({ color: 'brown', freq: 220, gain: 0.6 })} volume={0.35} />
      <Ambient sound={drone({ freqs: unlocked ? [55, 58.3, 82.4] : [55, 82.4, 110], cutoff: 420, gain: 0.18 })} volume={unlocked ? 0.35 : 0.18} />

      <EffectComposer multisampling={tier === 'high' ? 4 : 0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={unlocked ? new Vector2(0.0018, 0.0012) : new Vector2(0.0004, 0.0003)}
          radialModulation
          modulationOffset={0.4}
        />
        <Noise opacity={0.045} premultiply blendFunction={BlendFunction.SCREEN} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

/** Contextual mini-tutorials (Jimmy Nelson style): appear only when relevant. */
function useHints(fromElevator: boolean) {
  const isTouch = useUI((s) => s.isTouch);
  const firstTime = useMemo(() => game().visitedRooms.length === 0, []);
  const stage = useRef<'move' | 'elevator' | 'panel' | 'done'>(firstTime && !fromElevator ? 'move' : 'panel');
  const startPos = useRef<{ x: number; z: number } | null>(null);
  const lastHint = useRef<string | null>(null);

  useEffect(() => () => ui().setHint(null), []);

  useFrame(() => {
    const p = player.position;
    if (!startPos.current) startPos.current = { x: p.x, z: p.z };
    let hint: string | null = null;
    const s = stage.current;
    if (s === 'move') {
      hint = isTouch ? 'Joystick pour marcher · glissez pour regarder' : 'ZQSD / WASD pour marcher · souris pour regarder';
      if (Math.hypot(p.x - startPos.current.x, p.z - startPos.current.z) > 1.5) stage.current = 'elevator';
    } else if (s === 'elevator') {
      hint = 'L’ascenseur vous attend, au fond du hall.';
      if (p.z < HALL.back + 0.2) stage.current = 'panel';
    } else if (s === 'panel') {
      const inCabin = p.z < HALL.back - 0.2;
      hint = inCabin ? (isTouch ? 'Visez un bouton du panneau, puis ✋' : 'Visez un bouton du panneau, puis cliquez') : null;
      if (inCabin && useUI.getState().hoverLabel?.startsWith('Chambre')) hint = null;
    }
    if (hint !== lastHint.current) {
      lastHint.current = hint;
      ui().setHint(hint);
    }
  });
}
