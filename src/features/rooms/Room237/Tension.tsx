import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group, type PointLight } from 'three';
import { player, yawForward } from '@/features/hub/playerState';
import { sfx } from '@/lib/audio/sfx';
import { wood } from '@/lib/textures/procedural';
import { ENTRY_DOOR, INSCRIPTION_POS, BOUNDS } from './layout';
import { flash } from './state';

const tmp = new Vector3();
const fwd = new Vector3();

/**
 * Dread machinery. Everything is gated on `armed` (curtain lifted) and
 * stops when `exiting`. No jump scares: sounds behind you, a door that
 * closes, a shape at the edge of the beam.
 */
export function Tension({ armed, exiting, step }: { armed: boolean; exiting: boolean; step: number }) {
  return (
    <>
      <EntryDoor armed={armed} />
      <PhantomSteps armed={armed && !exiting} step={step} />
      <Silhouette armed={armed && !exiting} step={step} />
      <Heartbeat armed={armed && !exiting} />
    </>
  );
}

const DOOR_OPEN_ANGLE = 1.25;

/** The door you came through closes by itself — slowly — once you are deep in the room. */
function EntryDoor({ armed }: { armed: boolean }) {
  const ref = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const tex = useMemo(() => wood([1, 2], '#3b2617', 61), []);
  const s = useRef({ inside: 0, t: -1, creaks: 0, closed: false });
  const at: [number, number, number] = [0, 1.2, ENTRY_DOOR.z];

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    if (armed && st.t < 0) {
      // Trigger: spent a few seconds in the bedroom proper.
      if (player.position.z < 0.8) st.inside += dt;
      if (st.inside > 6) {
        st.t = 0;
        sfx.creak(at, 0.5);
      }
    }
    let open = 1;
    if (st.t >= 0) {
      st.t += dt;
      const u = Math.min(st.t / 7.5, 1);
      open = 1 - (u * u * (3 - 2 * u)); // smoothstep: slow start, slow end
      if (st.creaks === 0 && st.t > 3) {
        st.creaks = 1;
        sfx.creak(at, 0.45);
      }
      if (u >= 1 && !st.closed) {
        st.closed = true;
        sfx.thud(at, 0.35);
        window.setTimeout(() => sfx.click(at, 0.4), 120);
      }
    }
    if (ref.current) ref.current.rotation.y = -DOOR_OPEN_ANGLE * open;
    if (light.current) light.current.intensity = 1.4 * open;
  });

  const w = ENTRY_DOOR.width;
  return (
    <>
      <group ref={ref} position={[ENTRY_DOOR.xHinge, 0, ENTRY_DOOR.z]} rotation-y={-DOOR_OPEN_ANGLE}>
        <mesh position={[w / 2, 1.02, 0.025]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.02, 2.04, 0.045]} />
          <meshStandardMaterial map={tex} roughness={0.8} />
        </mesh>
        <mesh position={[w - 0.1, 1.0, -0.01]}>
          <sphereGeometry args={[0.028, 12, 10]} />
          <meshStandardMaterial color="#6d5a32" metalness={0.8} roughness={0.35} />
        </mesh>
        {/* 237 plate on the corridor side */}
        <mesh position={[w / 2, 1.6, 0.05]}>
          <boxGeometry args={[0.16, 0.06, 0.005]} />
          <meshStandardMaterial color="#7a5f2c" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      {/* Warm spill from the hotel corridor — dies as the door closes. */}
      <pointLight ref={light} position={[0, 2.1, 6.4]} color="#ffb070" intensity={1.4} distance={5} decay={2} />
    </>
  );
}

/**
 * Footsteps that are not yours: they fall *between* your steps, from 2–3 m
 * behind you, and stop one beat after you stop.
 */
function PhantomSteps({ armed, step }: { armed: boolean; step: number }) {
  const s = useRef({ time: 0, acc: 0, half: false, active: false, left: 0, events: 0, stopT: -1, next: 22 });

  useFrame((_, rawDt) => {
    if (!armed) return;
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    st.time += dt;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);

    if (!st.active && st.events < 2 && st.time > st.next && speed > 1 && (st.events === 0 || step >= 2)) {
      st.active = true;
      st.left = 6 + Math.floor(Math.random() * 3);
      st.acc = 0;
      st.half = false;
    }
    if (!st.active) return;

    const emit = (v: number) => {
      yawForward(player.yaw, fwd);
      tmp.copy(player.position).addScaledVector(fwd, -(2.2 + Math.random() * 0.6));
      tmp.x = Math.min(Math.max(tmp.x, BOUNDS.min[0] + 0.3), BOUNDS.max[0] - 0.3);
      tmp.z = Math.min(Math.max(tmp.z, BOUNDS.min[2] + 0.3), BOUNDS.max[2] - 0.3);
      sfx.step([tmp.x, 0.05, tmp.z], v);
    };

    if (speed > 0.4) {
      st.stopT = -1;
      // The Player steps every 0.75 m; we step at the half-period, offset.
      st.acc += speed * dt;
      if (st.acc > 0.375) {
        st.acc -= 0.375;
        st.half = !st.half;
        if (st.half) {
          emit(0.2);
          st.left--;
        }
      }
    } else {
      if (st.stopT < 0) st.stopT = 0;
      st.stopT += dt;
      // One last step after you stop… then nothing.
      if (st.stopT > 0.55) {
        emit(0.24);
        st.left = 0;
      }
    }
    if (st.left <= 0) {
      st.active = false;
      st.events++;
      st.next = st.time + 60 + Math.random() * 30;
    }
  });
  return null;
}

/** Where the shape stands: at the end of the corridor, in front of the closed door. */
const SHAPE_POS = new Vector3(0.1, 0, 4.55);

/**
 * Seen once: a figure at the edge of the beam. It exists only while it
 * stays in the outer ring of the cone; looking at it (or a battery stutter)
 * and it is gone for good.
 */
function Silhouette({ armed, step }: { armed: boolean; step: number }) {
  const ref = useRef<Group>(null);
  const s = useRef({ time: 0, state: 'waiting' as 'waiting' | 'shown' | 'gone', shownT: 0 });

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const st = s.current;
    if (!armed) {
      g.visible = false;
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    st.time += dt;
    if (st.state === 'gone') {
      g.visible = false;
      return;
    }
    const eye = player.eye;
    tmp.set(SHAPE_POS.x, 1.2, SHAPE_POS.z).sub(eye);
    const dist = tmp.length();
    tmp.divideScalar(dist);
    const angle = Math.acos(Math.min(1, Math.max(-1, tmp.dot(flash.dir))));
    // Line of sight through the 1.2 m archway at z = 2.
    let los = eye.z < 1.6 && flash.power > 0.5;
    if (los) {
      const k = (2 - eye.z) / (SHAPE_POS.z - eye.z);
      const xAt = eye.x + k * (SHAPE_POS.x - eye.x);
      los = Math.abs(xAt) < 0.45;
    }

    if (st.state === 'waiting') {
      const edge = angle > 0.3 && angle < 0.48;
      if (st.time > 35 && step >= 1 && los && edge && dist > 3) {
        st.state = 'shown';
        st.shownT = 0;
      }
    } else if (st.state === 'shown') {
      st.shownT += dt;
      // Looked at, out of sight, or lingered too long → gone, never again.
      if (angle < 0.24 || !los || st.shownT > 2.2) {
        st.state = 'gone';
        flash.stutter = 0.35;
        sfx.creak([SHAPE_POS.x, 1, SHAPE_POS.z], 0.18);
      }
    }
    g.visible = st.state === 'shown';
  });

  return (
    <group ref={ref} position={SHAPE_POS} visible={false}>
      {/* Tall, thin, slightly hunched — matte black, no face. */}
      <mesh position={[0, 0.85, 0]} rotation-x={0.08}>
        <capsuleGeometry args={[0.17, 1.15, 4, 10]} />
        <meshStandardMaterial color="#030303" roughness={1} />
      </mesh>
      <mesh position={[0.02, 1.72, 0.07]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshStandardMaterial color="#030303" roughness={1} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.22, 0.95, 0.02]} rotation-z={sd * 0.06}>
          <capsuleGeometry args={[0.045, 0.85, 3, 6]} />
          <meshStandardMaterial color="#030303" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Heartbeat quickening as you approach the carved wall. */
function Heartbeat({ armed }: { armed: boolean }) {
  const s = useRef({ next: 0 });
  const [ix, , iz] = INSCRIPTION_POS;
  useFrame((_, rawDt) => {
    if (!armed) return;
    const st = s.current;
    st.next -= Math.min(rawDt, 0.05);
    const d = Math.hypot(player.position.x - ix, player.position.z - iz);
    if (d > 3.4) {
      st.next = Math.min(st.next, 0.3);
      return;
    }
    if (st.next <= 0) {
      const k = 1 - d / 3.4; // 0 far → 1 at the wall
      sfx.heartbeat(0.12 + k * 0.45);
      st.next = 1.45 - k * 0.65;
    }
  });
  return null;
}
