import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Color, Fog, MathUtils, Vector2, Vector3, type Mesh } from 'three';
import { Player } from '@/features/hub/Player';
import { player } from '@/features/hub/playerState';
import { useRoom } from '@/features/rooms/useRoom';
import { RoomUI } from '@/features/rooms/RoomUI';
import { Ambient } from '@/lib/audio/Sound';
import { muffled, noise, withReverb } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { useQuality } from '@/lib/fx/quality';
import { ui, useUI } from '@/stores/uiStore';
import { BOUNDS, CEIL_EYE, COLLIDERS, POCKET, ROOM, START } from './layout';
import { mix, r042, resetRoom042, shared, water } from './state';
import { LiquidEffect } from './LiquidEffect';
import { surfaceMaterial } from './materials';
import { RoomSet, Shafts } from './Set';
import { Fish } from './Fish';
import { KeyFragment } from './Fragment';
import { view } from '@/lib/fx/fov';
import { Bubbles, ExhaleBubbles, Plankton, emitExhale } from './Particles';
import { OxygenUI } from './OxygenUI';
import { breathIn, breathOut, drainGurgle, waterBed, whaleSong } from './audio';

const EXIT_DELAY = 4500;
/** Seconds for a full tank to empty. Generous: this room is about drifting, not drowning. */
const O2_SECONDS = 85;

const FOG_UNDER = new Color('#06323e');
const FOG_AIR = new Color('#0d1a1c');

/**
 * Chambre 042 — « Sous l'eau ». A drowned hotel room. Swim, breathe in the
 * air well by the door, follow the glowing fish: it leads you to fragment 2
 * under the bed. On completion the water drains away and gravity returns.
 */
export default function Room042() {
  const { complete, exiting } = useRoom('042');
  const { tier, heavyFx, particles, reducedMotion } = useQuality();
  const liquid = useMemo(() => new LiquidEffect(), []);
  const caOffset = useMemo(() => new Vector2(0.0012, 0.0008), []);

  useMemo(resetRoom042, []);

  useEffect(() => () => liquid.dispose(), [liquid]);

  // Exit: the room drains — gurgle, then drips from the ceiling.
  useEffect(() => {
    if (!exiting) return;
    drainGurgle(0.55);
    sfx.bubbles([POCKET.x, 1, POCKET.z], 0.5);
    let alive = true;
    const timers: number[] = [];
    const drip = () => {
      if (!alive) return;
      const at: [number, number, number] = [
        MathUtils.randFloat(ROOM.minX + 0.5, ROOM.maxX - 0.5),
        MathUtils.randFloat(1.5, 3),
        MathUtils.randFloat(ROOM.minZ + 0.5, ROOM.maxZ - 0.5),
      ];
      sfx.drip(at, 0.25 + Math.random() * 0.2);
      timers.push(window.setTimeout(drip, 180 + Math.random() * 420));
    };
    timers.push(window.setTimeout(drip, 1400));
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [exiting]);

  const fx: JSX.Element[] = [];
  if (heavyFx) fx.push(<DepthOfField key="dof" worldFocusDistance={3} worldFocusRange={9} bokehScale={reducedMotion ? 1 : 2} />);
  fx.push(
    <primitive key="liquid" object={liquid} />,
    <Bloom key="bloom" mipmapBlur intensity={1.05} luminanceThreshold={0.78} luminanceSmoothing={0.22} />,
    <Vignette key="vig" offset={0.22} darkness={0.85} />,
    <ChromaticAberration key="ca" blendFunction={BlendFunction.NORMAL} offset={caOffset} radialModulation modulationOffset={0.3} />,
  );

  return (
    <>
      <color attach="background" args={['#06323e']} />
      <fog attach="fog" args={['#06323e', 0.4, 13]} />

      <hemisphereLight args={['#7fd4e0', '#0b2a2e', 0.55]} />
      <ambientLight color="#2d6a78" intensity={0.15} />
      <directionalLight
        position={[4, 8, -1.5]}
        color="#9fe6f0"
        intensity={1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />

      <RoomSet />
      <Shafts />
      <Fish />
      <KeyFragment onTake={() => complete({ exitDelay: EXIT_DELAY })} />
      <Bubbles count={Math.round(260 * particles)} />
      <Plankton count={Math.round(900 * particles)} />
      <ExhaleBubbles />
      <DrainSurface />

      <Player start={START} yaw={0} mode="swim" speed={2.1} bounds={BOUNDS} colliders={COLLIDERS} footsteps={false} />
      {/* Must mount after <Player/> so its useFrame runs after the controller's. */}
      <Logic liquid={liquid} caOffset={caOffset} reducedMotion={reducedMotion} />

      <EffectComposer multisampling={tier === 'high' ? 4 : 0}>{fx}</EffectComposer>

      <Ambient sound={waterBed()} volume={0.55} />
      <Ambient sound={withReverb(whaleSong(), { seconds: 4, decay: 2.2, wet: 0.75 })} volume={0.35} fade={4} />
      <Ambient sound={muffled(noise({ color: 'pink', type: 'bandpass', freq: 900, q: 0.6 }), 700)} volume={0.1} />

      <RoomUI.In>
        <OxygenUI reducedMotion={reducedMotion} />
      </RoomUI.In>
    </>
  );
}

/** The descending water line during the exit drain (a full-room surface). */
function DrainSurface() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(() => surfaceMaterial(0.9), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.visible = ui().exiting && water.drain > 0.001 && water.drain < 0.995;
    m.position.y = water.level;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} renderOrder={4} material={material}>
      <planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ]} />
    </mesh>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Per-frame room logic: air-well constraint, oxygen, breathing, fail state,
 * drain/gravity on exit, underwater ↔ air mix, contextual hints.
 * ────────────────────────────────────────────────────────────────────────── */
const tmpBefore = new Vector3();
const tmpDir = new Vector3();
const tmpMouth = new Vector3();
const VENT_SPOTS: [number, number, number][] = [
  [-1.6, 0.2, -3.3],
  [-3.6, 0.3, 0.4],
  [3.55, 0.9, -0.6],
  [-0.2, 0.1, -0.8],
];

function Logic({ liquid, caOffset, reducedMotion }: { liquid: LiquidEffect; caOffset: Vector2; reducedMotion: boolean }) {
  const scene = useThree((s) => s.scene);
  const isTouch = useUI((s) => s.isTouch);
  const rt = useRef({
    o2: 1,
    push: 0,
    breathT: 2.5,
    inhaleNext: true,
    failing: false,
    breathedOnce: false,
    moved: false,
    clock: 0,
    hint: null as string | null,
    heart: 0,
    drainT: 0,
    inShaft: false,
    above: false,
    sub: 1,
    ambient: 6,
    creak: 14,
    timers: [] as number[],
  });

  useEffect(() => {
    const r = rt.current;
    return () => {
      r.timers.forEach((t) => window.clearTimeout(t));
      ui().setHint(null);
      player.movementEnabled = true;
    };
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const r = rt.current;
    const u = ui();
    const exiting = u.exiting;
    const pos = player.position;
    const vel = player.velocity;
    water.reducedMotion = reducedMotion;
    shared.uMotion.value = reducedMotion ? 0.4 : 1;
    water.time += dt;
    shared.uTime.value = water.time;
    r.clock += dt;
    // Water magnifies: narrower FOV (re-asserted — the scene host resets it on mount).
    // <ResponsiveFov/> applies it, widened on portrait screens.
    view.baseFov = 64;

    tmpBefore.copy(pos);

    // ── Air well: only inside the shaft can the head rise above the ceiling.
    const lim = POCKET.half - 0.22;
    const inShaftXZ = Math.abs(pos.x - POCKET.x) < lim && Math.abs(pos.z - POCKET.z) < lim;
    if (pos.y > CEIL_EYE) {
      if (r.inShaft && !inShaftXZ) {
        pos.x = MathUtils.clamp(pos.x, POCKET.x - lim, POCKET.x + lim);
        pos.z = MathUtils.clamp(pos.z, POCKET.z - lim, POCKET.z + lim);
      } else if (!inShaftXZ) {
        pos.y = CEIL_EYE;
        vel.y = Math.min(vel.y, 0);
      }
    }
    r.inShaft = pos.y > CEIL_EYE;
    // Gentle buoyancy at the surface: you bob there instead of shooting up.
    if (pos.y > POCKET.surface + 0.12) vel.y -= dt * 1.5;

    // ── Exit: water drains, gravity returns.
    if (exiting) {
      r.drainT += dt;
      const k = MathUtils.clamp(r.drainT / 3.4, 0, 1);
      const e = k * k * (3 - 2 * k);
      water.drain = e;
      water.level = MathUtils.lerp(POCKET.surface, -0.05, e);
      const stand = 1.55;
      vel.multiplyScalar(Math.exp(-dt * 4));
      vel.y = 0;
      if (pos.y > stand) pos.y = Math.max(stand, Math.min(pos.y, water.level + 0.08));
      else if (water.level < stand) pos.y += (stand - pos.y) * (1 - Math.exp(-dt * 2.5));
    } else {
      water.level = POCKET.surface;
    }
    shared.uDrain.value = water.drain;

    // Push our correction to the camera this same frame (Player already wrote it).
    const dy = pos.y - tmpBefore.y;
    const dx = pos.x - tmpBefore.x;
    const dz = pos.z - tmpBefore.z;
    if (dx || dy || dz) {
      player.eye.x += dx;
      player.eye.y += dy;
      player.eye.z += dz;
      if (player.controlsCamera) state.camera.position.set(state.camera.position.x + dx, state.camera.position.y + dy, state.camera.position.z + dz);
    }

    // ── Under / above water.
    const eyeY = player.eye.y;
    const above = eyeY > water.level + 0.02;
    r.sub += ((above ? 0 : 1) - r.sub) * (1 - Math.exp(-dt * 6));
    water.submerged = r.sub;
    const sub = r.sub;

    // ── Oxygen.
    const paused = !!u.note || u.transition.active || u.paused || exiting || r.failing;
    const breathingAir = above && !exiting;
    if (breathingAir && !r.above) {
      breathIn(0.4, true);
      sfx.bubbles([pos.x, POCKET.surface, pos.z], 0.3);
      if (!r.breathedOnce) ui().showToast('Vous respirez. L’air sent le chlore et la moquette mouillée.');
      r.breathedOnce = true;
    }
    r.above = breathingAir;
    if (breathingAir) r.o2 = Math.min(1, r.o2 + dt * 0.45);
    else if (!paused) r.o2 = Math.max(0, r.o2 - dt / O2_SECONDS);

    const low = r.o2 < 0.25 && !breathingAir && !exiting;
    if (low && !paused) {
      r.heart -= dt;
      if (r.heart <= 0) {
        r.heart = 0.7 + r.o2 * 3;
        sfx.heartbeat(0.25 + (0.25 - r.o2) * 1.5);
      }
    }

    if (r.o2 <= 0 && !r.failing && !exiting) {
      r.failing = true;
      player.movementEnabled = false;
      r042().set({ blackout: true });
      sfx.heartbeat(0.6);
      r.timers.push(
        window.setTimeout(() => {
          player.position.set(...START);
          player.velocity.set(0, 0, 0);
          r.o2 = 1;
          r042().set({ o2: 1 });
        }, 1700),
        window.setTimeout(() => {
          r042().set({ blackout: false });
          player.movementEnabled = true;
          r.failing = false;
          breathIn(0.45, true);
          ui().showToast('Vous rouvrez les yeux près de la porte. L’hôtel vous a recraché.');
        }, 2600),
      );
    }

    r.push -= dt;
    const st = r042();
    if (r.push <= 0 || st.breathing !== breathingAir) {
      r.push = 0.1;
      const o2 = Math.round(r.o2 * 200) / 200;
      if (st.o2 !== o2 || st.breathing !== breathingAir) st.set({ o2, breathing: breathingAir });
    }

    // ── Breathing cycle (regulator in, bubbles out).
    if (!breathingAir && !exiting && !r.failing && !paused) {
      r.breathT -= dt;
      if (r.breathT <= 0) {
        const period = low ? 3.0 : r.o2 < 0.5 ? 4.4 : 5.6;
        if (r.inhaleNext) {
          breathIn(0.16);
          r.breathT = period * 0.45;
        } else {
          breathOut(0.2);
          state.camera.getWorldDirection(tmpDir);
          tmpMouth.copy(player.eye).addScaledVector(tmpDir, 0.28);
          tmpMouth.y -= 0.1;
          emitExhale(tmpMouth);
          r.breathT = period * 0.55;
        }
        r.inhaleNext = !r.inhaleNext;
      }
    }

    // ── Sporadic ambience.
    if (!exiting) {
      r.ambient -= dt;
      if (r.ambient <= 0) {
        r.ambient = 5 + Math.random() * 7;
        sfx.bubbles(VENT_SPOTS[Math.floor(Math.random() * VENT_SPOTS.length)], 0.22);
      }
      r.creak -= dt;
      if (r.creak <= 0) {
        r.creak = 14 + Math.random() * 14;
        sfx.creak([Math.random() > 0.5 ? ROOM.minX : ROOM.maxX, 2.5, MathUtils.randFloat(-4, 4)], 0.15);
      }
    }

    // ── Underwater ↔ air look.
    const fog = scene.fog;
    if (fog instanceof Fog) {
      const air = 1 - sub;
      fog.near = MathUtils.lerp(0.4, 5, air);
      fog.far = MathUtils.lerp(13, 45, air);
      fog.color.copy(FOG_UNDER).lerp(FOG_AIR, air);
      if (scene.background instanceof Color) scene.background.copy(fog.color);
    }
    shared.uCaustic.value = 1.25 * (1 - water.drain) * (0.35 + 0.65 * sub);
    const motion = reducedMotion ? 0.3 : 1;
    liquid.warp = sub * 0.0042 * motion;
    liquid.tint = sub;
    const darkTarget = r.failing ? 1 : exiting ? 0 : MathUtils.clamp((0.3 - r.o2) / 0.3, 0, 1) * 0.75;
    liquid.dark = darkTarget;
    const lowPulse = low && !reducedMotion ? 0.0015 * (0.5 + 0.5 * Math.sin(r.clock * 5)) : 0;
    const ca = (0.0011 * sub + lowPulse) * (reducedMotion ? 0.35 : 1);
    caOffset.set(ca, ca * 0.7);
    mix.cutoff = MathUtils.lerp(low ? 320 : 480, 7000, 1 - sub);

    // ── Contextual hints.
    let hint: string | null = null;
    if (!exiting && !r.failing && !u.transition.active) {
      if (!r.moved) {
        hint = isTouch
          ? 'Joystick pour nager · ▲ ▼ pour monter et descendre'
          : 'Vous nagez là où vous regardez · Espace pour monter · C pour descendre';
        if (Math.hypot(pos.x - START[0], pos.y - START[1], pos.z - START[2]) > 1.6 || r.clock > 16) r.moved = true;
      } else if (breathingAir) {
        hint = r.o2 < 0.97 ? 'Respirez. Restez à la surface le temps de remplir vos poumons.' : null;
      } else if (r.o2 < 0.5 && (!r.breathedOnce || r.o2 < 0.3)) {
        hint = `Votre souffle s’épuise. Une poche d’air, au plafond, près de la porte. Montez (${isTouch ? '▲' : 'Espace'}).`;
      } else if (st.phase === 'idle') {
        hint = 'Une lueur orange tourne dans la chambre. Approchez-la.';
      } else if (st.phase === 'lead' && st.fishWaiting) {
        hint = 'Le poisson vous attend. Suivez-le — écoutez ses bulles.';
      } else if (st.phase === 'reveal') {
        hint = `Quelque chose brille sous le lit. Descendez (${isTouch ? '▼' : 'C'}) pour regarder dessous.`;
      }
    }
    if (hint !== r.hint) {
      r.hint = hint;
      ui().setHint(hint);
    }
  });

  return null;
}
