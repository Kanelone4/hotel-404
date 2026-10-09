import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { MathUtils, type Group } from 'three';
import { Player } from '@/features/hub/Player';
import { player } from '@/features/hub/playerState';
import { useRoom } from '@/features/rooms/useRoom';
import { RoomUI } from '@/features/rooms/RoomUI';
import { Ambient, Spatial } from '@/lib/audio/Sound';
import { withReverb, drone, musicBox, muffled } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { useQuality } from '@/lib/fx/quality';
import { useUI, ui } from '@/stores/uiStore';
import { H, SPAWN, BOUNDS, COLLIDERS, KEY_REFLECTION } from './layout';
import { FlippedRoom } from './FlippedRoom';
import { CeilingMirror } from './CeilingMirror';
import { Gravity } from './Gravity';
import { InvertedLensEffect } from './InvertedLensEffect';
import { breathUniforms } from './materials';
import { creaks, breath } from './audio';

const EYE = 1.62;
/** Eye height when standing on the *real* floor, upside-down (intro start / exit end). */
const EYE_FLIPPED = H - EYE;

const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

/**
 * Chambre 013 — « Tout est à l'envers ».
 * The room is flipped; you walk on the ceiling. The key "3" is glued to the
 * carpet above your head. You cannot reach up — but the old ceiling mirror,
 * now in your floor, shows the room right-side-up. Take the key *in the mirror*.
 */
export default function Room013() {
  const { complete, exiting } = useRoom('013');
  const curtain = useUI((s) => s.transition.active);
  const { tier, reducedMotion } = useQuality();
  const camera = useThree((s) => s.camera);

  const [dropped, setDropped] = useState(false);
  const [keyReleased, setKeyReleased] = useState(false);
  const [keyTaken, setKeyTaken] = useState(false);
  const [fade, setFade] = useState(false);

  const lens = useMemo(() => new InvertedLensEffect(), []);
  useEffect(() => () => lens.dispose(), [lens]);

  const lights = useRef(1);
  const fx = useRef({ flip: -1, nextFlip: 14, aberrationKick: 0, shake: 0 });
  const intro = useRef({ t: 0, phase: 'pre' as 'pre' | 'hold' | 'fall' | 'land' | 'done' });
  const exit = useRef<{ t: number; from: { x: number; y: number; z: number; pitch: number; yaw: number } } | null>(null);
  const story = useRef({ introDoneAt: -1, attemptAt: -1, attempts: 0, landed: false, now: 0 });
  const lastHint = useRef<string | null>(null);
  const belowFeet = useRef<Group>(null);

  const flipPulse = useCallback(() => {
    if (!reducedMotion) fx.current.flip = 0;
    fx.current.aberrationKick = 1;
  }, [reducedMotion]);

  // The arrival cutscene owns the camera from the very first frame (behind the curtain).
  useEffect(() => {
    player.controlsCamera = false;
    player.movementEnabled = false;
    return () => {
      player.controlsCamera = true;
      player.movementEnabled = true;
      ui().setHint(null);
    };
  }, []);

  const setCam = (x: number, y: number, z: number, pitch: number, yaw: number, roll: number) => {
    camera.position.set(x, y, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, roll);
  };

  // ── Exit: the world turns right-side-up again (camera rolls back, gravity reverts) ──
  useEffect(() => {
    if (!exiting) return;
    player.controlsCamera = false;
    player.movementEnabled = false;
    exit.current = {
      t: 0,
      from: { x: camera.position.x, y: camera.position.y, z: camera.position.z, pitch: player.pitch, yaw: player.yaw },
    };
    sfx.rumble(0.45, 2.6);
    sfx.creak(undefined, 0.5);
    flipPulse();
    const id = window.setTimeout(() => setFade(true), 2900);
    return () => window.clearTimeout(id);
  }, [exiting, camera, flipPulse]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const time = clock.elapsedTime;
    story.current.now = time;
    const f = fx.current;

    // ── Intro: you stand on the real floor, upside-down… then gravity flips. ──
    const I = intro.current;
    const hold = reducedMotion ? 0.5 : 1.1;
    const fall = reducedMotion ? 1.0 : 1.35;
    const land = reducedMotion ? 0.45 : 0.9;
    const [sx, , sz] = SPAWN;
    if (I.phase !== 'done' && !exit.current) {
      // Re-assert every frame: shared scene setup may reset these after our mount effect.
      player.controlsCamera = false;
      player.movementEnabled = false;
      if (curtain) {
        I.phase = 'pre';
        I.t = 0;
        setCam(sx, EYE_FLIPPED, sz, 0, 0, Math.PI);
      } else {
        if (I.phase === 'pre') {
          I.phase = 'hold';
          sfx.creak([0, H, -1], 0.5);
        }
        I.t += dt;
        let y = EYE_FLIPPED;
        let roll = Math.PI;
        let pitch = 0;
        let yaw = 0;
        let jitter = 0;
        if (I.t < hold) {
          jitter = reducedMotion ? 0 : (I.t / hold) * 0.012; // the room trembles
          lights.current = Math.sin(time * 40) > 0.6 ? 0.5 : 1;
        } else if (I.t < hold + fall) {
          if (I.phase === 'hold') {
            I.phase = 'fall';
            setDropped(true);
            sfx.whoosh(0.55);
            sfx.rumble(0.4, 1.6);
            flipPulse();
          }
          const u = (I.t - hold) / fall;
          roll = Math.PI * (1 - easeInOut(u));
          y = EYE_FLIPPED + (0.75 - EYE_FLIPPED) * easeIn(u);
          pitch = -0.55 * Math.sin(Math.PI * u);
          yaw = (reducedMotion ? 0.08 : 0.3) * Math.sin(Math.PI * u);
          lights.current = 0.45 + 0.55 * Math.abs(Math.cos(u * 9));
        } else if (I.t < hold + fall + land) {
          if (I.phase === 'fall') {
            I.phase = 'land';
            sfx.thud(undefined, 0.9);
            f.shake = reducedMotion ? 0 : 1;
          }
          const u = (I.t - hold - fall) / land;
          roll = 0;
          y = 0.75 + (EYE - 0.75) * easeOut(u);
          lights.current = 1;
        } else {
          I.phase = 'done';
          story.current.introDoneAt = time;
          player.controlsCamera = true;
          player.movementEnabled = true;
        }
        if (I.phase !== 'done') {
          setCam(
            sx + (Math.random() - 0.5) * jitter,
            y + (Math.random() - 0.5) * jitter,
            sz,
            pitch,
            yaw,
            roll,
          );
        }
      }
    }

    // ── Exit choreography ──
    const E = exit.current;
    if (E) {
      const dur = reducedMotion ? 1.8 : 2.5;
      E.t = Math.min(E.t + dt, dur);
      const u = easeInOut(E.t / dur);
      const { from } = E;
      setCam(
        from.x,
        MathUtils.lerp(from.y, EYE_FLIPPED, u),
        from.z,
        MathUtils.lerp(from.pitch, 0, u),
        from.yaw + (reducedMotion ? 0.1 : 0.5) * u,
        Math.PI * u,
      );
      lights.current = 1 + 0.6 * Math.sin(Math.PI * u);
    }

    // ── Landing / ambient shake, applied over whoever wrote the camera ──
    if (f.shake > 0) {
      f.shake = Math.max(0, f.shake - dt * 1.8);
      const a = f.shake * 0.03;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }

    // ── Post FX ──
    if (!reducedMotion && I.phase === 'done' && !E) {
      f.nextFlip -= dt;
      if (f.nextFlip <= 0) {
        f.flip = 0;
        f.nextFlip = 14 + Math.random() * 16;
        sfx.glitch(undefined, 0.12);
      }
    }
    let flipU = 0;
    if (f.flip >= 0) {
      f.flip += dt / 0.45;
      if (f.flip >= 1) f.flip = -1;
      else flipU = f.flip;
    }
    f.aberrationKick = Math.max(0, f.aberrationKick - dt * 0.8);
    const baseAb = reducedMotion ? 0.0012 : 0.0055;
    const kick = reducedMotion ? 0.002 : 0.012;
    lens.set('uTime', time);
    lens.set('uAberration', baseAb + f.aberrationKick * kick + Math.sin(time * 0.37) * baseAb * 0.25);
    lens.set('uWobble', reducedMotion ? 0.15 : 1);
    lens.set('uFlip', flipU);

    breathUniforms.uTime.value = time;
    breathUniforms.uAmp.value = reducedMotion ? 0.02 : 0.06;

    // Creaks come from below your feet, wandering slowly.
    if (belowFeet.current) {
      const p = player.position;
      belowFeet.current.position.set(p.x + Math.sin(time * 0.21) * 1.5, -1.6, p.z + Math.cos(time * 0.17) * 1.5);
    }

    updateHints();
  });

  // ── Contextual hints (idle-based) ─────────────────────────────────────────
  const updateHints = () => {
    const s = story.current;
    let hint: string | null = null;
    if (keyTaken || exiting) hint = null;
    else if (keyReleased) hint = s.landed ? 'La clé est tombée vers vous. Ramassez-la.' : null;
    else if (s.introDoneAt >= 0) {
      const t = s.now - s.introDoneAt;
      const ta = s.attemptAt >= 0 ? s.now - s.attemptAt : -1;
      if (t < 6) hint = 'Le plafond est votre sol, désormais. Tout est tombé… presque tout.';
      else if (ta < 0) {
        if (t > 80) hint = 'Ce qui est en haut ne se voit à l’endroit… que dans un miroir.';
        else if (t > 28) hint = 'Quelque chose brille là-haut, à côté du lit. Levez la tête.';
      } else if (ta > 40) hint = 'Regardez le miroir à vos pieds, et visez le reflet de la clé.';
      else if (ta > 14) hint = 'Ce qui est en haut ne se voit à l’endroit… que dans un miroir.';
    }
    if (hint !== lastHint.current) {
      lastHint.current = hint;
      ui().setHint(hint);
    }
  };

  // ── Puzzle callbacks ──────────────────────────────────────────────────────
  const onReachKey = () => {
    const s = story.current;
    if (s.attemptAt < 0) s.attemptAt = s.now;
    s.attempts++;
    sfx.thud(undefined, 0.2);
    const lines = [
      'Trop haut. Et ici, sauter, c’est tomber vers le haut.',
      'Vos doigts brassent le vide. La clé, elle, n’a pas été prévenue que tout s’était retourné.',
      'Elle ne se donne pas à l’envers. Peut-être à l’endroit ?',
    ];
    ui().showToast(lines[Math.min(s.attempts - 1, lines.length - 1)]);
  };

  const onGrabReflection = () => {
    if (keyReleased) return;
    setKeyReleased(true);
    if (story.current.attemptAt < 0) story.current.attemptAt = story.current.now;
    sfx.glitch(undefined, 0.3);
    sfx.whoosh(0.35);
    flipPulse();
    ui().showToast('Le reflet cède sous vos doigts. Là-haut, quelque chose se décroche.');
  };

  const onKeyLanded = () => {
    story.current.landed = true;
  };

  const onTakeKey = () => {
    if (keyTaken) return;
    setKeyTaken(true);
    ui().setHint(null);
    complete({ exitDelay: 4200 });
  };

  // ── Audio factories (read once on mount by <Ambient/>/<Spatial/>) ─────────
  const sounds = useMemo(
    () => ({
      breath: withReverb(breath(0.7), { reverse: true, seconds: 3, wet: 0.6 }),
      drone: withReverb(drone({ freqs: [49, 73.4, 92.5], type: 'triangle', cutoff: 380, gain: 0.16, tremolo: 0.07 }), {
        reverse: true,
        seconds: 3.5,
        wet: 0.7,
      }),
      creaks: withReverb(creaks({ min: 2.5, max: 8 }), { reverse: true, seconds: 2.2, wet: 0.65 }),
      // An upside-down lullaby (descending), coming from *inside* the mirror.
      mirrorBox: muffled(
        withReverb(
          musicBox({ notes: [12, 9, 7, 4, 2, 0, null, null, 14, 12, 9, 7, 5, 4, null, null], root: 440, bpm: 66, gain: 0.25 }),
          { reverse: true, seconds: 2.5, wet: 0.65 },
        ),
        2400,
      ),
    }),
    [],
  );

  const multisampling = tier === 'high' ? 4 : 0;

  return (
    <>
      <color attach="background" args={['#0b0608']} />
      <fog attach="fog" args={['#0b0608', 6, 17]} />
      <hemisphereLight args={['#5a3a40', '#ffe2b8', 0.28]} />
      <ambientLight intensity={0.06} />

      <FlippedRoom keyReleased={keyReleased} onReachKey={onReachKey} lightsRef={lights} />
      <CeilingMirror armed={!keyReleased} onGrabReflection={onGrabReflection} quality={tier} />
      <Gravity
        running={dropped}
        reverted={exiting}
        keyReleased={keyReleased}
        keyTaken={keyTaken}
        onTakeKey={onTakeKey}
        onKeyLanded={onKeyLanded}
      />

      <Player start={SPAWN} yaw={0} bounds={BOUNDS} colliders={COLLIDERS} speed={2.4} eyeHeight={EYE} crouchHeight={0.75} />

      {/* Audio: inverted reverb everywhere, sources below your feet */}
      <Ambient sound={sounds.breath} volume={0.4} />
      <Ambient sound={sounds.drone} volume={0.22} />
      <group ref={belowFeet} position={[0, -1.6, 0]}>
        <Spatial sound={sounds.creaks} volume={1} refDistance={1.6} rolloff={1.2} />
      </group>
      {!keyReleased && <Spatial sound={sounds.mirrorBox} position={KEY_REFLECTION} volume={0.6} refDistance={1.4} rolloff={1.6} />}

      <EffectComposer multisampling={multisampling}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
        <primitive object={lens} dispose={null} />
        <Noise opacity={0.05} premultiply blendFunction={BlendFunction.SCREEN} />
        <Vignette offset={0.22} darkness={0.85} />
      </EffectComposer>

      <RoomUI.In>
        <div
          className="absolute inset-0 bg-ink transition-opacity duration-[1200ms] ease-in"
          style={{ opacity: fade ? 1 : 0 }}
        />
      </RoomUI.In>
    </>
  );
}
