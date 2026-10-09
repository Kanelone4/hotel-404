import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type Group,
  type PointLight,
  type SpriteMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Spatial } from '@/lib/audio/Sound';
import { sfx } from '@/lib/audio/sfx';
import { glow } from '@/lib/textures/procedural';
import { player } from '@/features/hub/playerState';
import { ui } from '@/stores/uiStore';
import { FISH_IDLE, FISH_PATH, FISH_REVEAL, POCKET } from './layout';
import { r042, shared, water } from './state';
import { fishVoice } from './audio';

/* ──────────────────────────────────────────────────────────────────────────
 * Low-poly fish, head toward +Z (Object3D.lookAt points +Z at the target).
 * Body = squashed 8×6 sphere (flat shaded), plus tail / dorsal / pectoral
 * triangles merged into ONE geometry so a single vertex wiggle bends it all.
 * ────────────────────────────────────────────────────────────────────────── */
function tri(verts: number[]) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((verts.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

function fishGeometry() {
  const body = new SphereGeometry(1, 8, 6).toNonIndexed();
  body.scale(0.065, 0.085, 0.2);
  const tail = tri([
    0, 0, -0.17, 0, 0.11, -0.34, 0, 0.0, -0.27,
    0, 0, -0.17, 0, 0.0, -0.27, 0, -0.11, -0.34,
  ]);
  const dorsal = tri([0, 0.07, 0.05, 0, 0.15, -0.08, 0, 0.065, -0.11]);
  const ventral = tri([0, -0.07, -0.02, 0, -0.11, -0.1, 0, -0.06, -0.12]);
  const finL = tri([0.05, -0.02, 0.05, 0.13, -0.06, -0.03, 0.05, -0.03, -0.02]);
  const finR = tri([-0.05, -0.02, 0.05, -0.05, -0.03, -0.02, -0.13, -0.06, -0.03]);
  const g = mergeGeometries([body, tail, dorsal, ventral, finL, finR]);
  g.computeVertexNormals();
  return g;
}

/** Orange emissive, flat shaded; vertex shader swims (travelling sine toward the tail). */
function fishMaterial(swim: { value: number }) {
  const m = new MeshStandardMaterial({
    color: '#ff8a3a',
    emissive: new Color('#ff5a12'),
    emissiveIntensity: 2.2,
    roughness: 0.35,
    metalness: 0.1,
    flatShading: true,
    side: DoubleSide,
    toneMapped: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uSwim = swim;
    shader.vertexShader =
      'uniform float uTime;\nuniform float uSwim;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // 0 at the head, 1 at the tail tip.
          float k = smoothstep(0.08, -0.34, position.z);
          float phase = uTime * (5.0 + uSwim * 6.0) - position.z * 14.0;
          transformed.x += sin(phase) * (0.012 + 0.05 * k * k) * (0.6 + uSwim * 0.6);
          // Pectoral fins paddle.
          float fin = step(0.045, abs(position.x)) * step(position.y, -0.015);
          transformed.y += fin * sin(uTime * 7.0 + sign(position.x) * 1.5) * 0.02;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'r042-fish';
  return m;
}

const tmpTarget = new Vector3();
const tmpDesired = new Vector3();
const tmpLook = new Vector3();
const dummy = new Object3D();

export function Fish() {
  const group = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const halo = useRef<SpriteMaterial>(null);
  const swim = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(fishGeometry, []);
  const material = useMemo(() => fishMaterial(swim), [swim]);
  const eyeMat = useMemo(() => new MeshStandardMaterial({ color: '#05080a', roughness: 0.2 }), []);
  const sim = useRef({
    pos: FISH_IDLE.clone(),
    vel: new Vector3(),
    idx: 0,
    hold: FISH_IDLE.clone(),
    waiting: false,
    nextBubble: 3,
    scale: 1,
  });

  useFrame(({ clock }, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const s = sim.current;
    const st = r042();
    const eye = player.eye;
    const distPlayer = s.pos.distanceTo(eye);
    let maxSpeed = 0.7;
    let waiting = false;

    if (st.phase === 'idle') {
      // Lazy figure-eight near the entrance.
      tmpTarget.set(
        FISH_IDLE.x + Math.sin(t * 0.45) * 1.1,
        FISH_IDLE.y + Math.sin(t * 0.9) * 0.25,
        FISH_IDLE.z + Math.sin(t * 0.9) * 0.55,
      );
      if (distPlayer < 2.3 && !ui().exiting && !ui().transition.active) {
        r042().set({ phase: 'lead' });
        s.idx = 0;
        sfx.bubbles(s.pos.toArray(), 0.45);
        ui().showToast('Le poisson vous fixe. Puis il s’éloigne… en vous attendant.');
      }
    } else if (st.phase === 'lead') {
      const wp = FISH_PATH[s.idx];
      if (distPlayer > 3.3) {
        // Too far ahead: hold position, circle, call out.
        waiting = true;
        if (!s.waiting) s.hold.copy(s.pos);
        tmpTarget.set(s.hold.x + Math.cos(t * 1.6) * 0.22, s.hold.y + Math.sin(t * 2.1) * 0.08, s.hold.z + Math.sin(t * 1.6) * 0.22);
        maxSpeed = 0.5;
      } else {
        tmpTarget.copy(wp);
        maxSpeed = distPlayer < 1.6 ? 1.05 : 0.8;
        if (s.pos.distanceTo(wp) < 0.3) {
          s.idx++;
          if (s.idx >= FISH_PATH.length) {
            r042().set({ phase: 'reveal' });
            sfx.bubbles(FISH_REVEAL.toArray(), 0.5);
          }
        }
      }
    } else if (st.phase === 'reveal') {
      // Hover under the bed, tracing a slow circle over the fragment.
      tmpTarget.set(FISH_REVEAL.x + Math.cos(t * 0.8) * 0.3, FISH_REVEAL.y + Math.sin(t * 1.3) * 0.04, FISH_REVEAL.z + Math.sin(t * 0.8) * 0.18);
      maxSpeed = 0.45;
    } else {
      // Fragment taken: it rises to the air well and circles there.
      tmpTarget.set(POCKET.x + Math.cos(t * 0.7) * 0.4, 2.5 + Math.sin(t) * 0.15, POCKET.z + Math.sin(t * 0.7) * 0.4);
      maxSpeed = 0.9;
    }
    s.waiting = waiting;
    if (st.fishWaiting !== waiting) r042().set({ fishWaiting: waiting });

    // Steering: ease velocity toward a desired velocity (arrive behaviour).
    tmpDesired.subVectors(tmpTarget, s.pos);
    const d = tmpDesired.length();
    if (d > 1e-4) tmpDesired.multiplyScalar(Math.min(maxSpeed, d * 1.6) / d);
    s.vel.lerp(tmpDesired, 1 - Math.exp(-dt * 2.4));
    s.pos.addScaledVector(s.vel, dt);
    g.position.copy(s.pos);

    const speed = s.vel.length();
    if (speed > 0.02) {
      dummy.position.copy(s.pos);
      tmpLook.copy(s.pos).add(s.vel);
      dummy.lookAt(tmpLook);
      g.quaternion.slerp(dummy.quaternion, 1 - Math.exp(-dt * 5));
    }
    swim.value += ((waiting ? 0.9 : Math.min(speed / 0.8, 1.4)) - swim.value) * (1 - Math.exp(-dt * 3));

    // Glow pulses while it waits for you; dissolves when the water drains.
    s.scale += ((1 - water.drain) - s.scale) * (1 - Math.exp(-dt * 3));
    g.scale.setScalar(Math.max(s.scale, 0.0001));
    const pulse = waiting ? 1 + Math.sin(t * 6) * 0.45 : 1;
    material.emissiveIntensity = 2.2 * pulse;
    if (light.current) light.current.intensity = (st.phase === 'reveal' ? 3.2 : 2.2) * pulse * s.scale;
    if (halo.current) halo.current.opacity = 0.55 * pulse * s.scale;

    // Little bursts of bubbles, more often when it calls you.
    s.nextBubble -= dt;
    if (s.nextBubble <= 0 && st.phase !== 'taken') {
      s.nextBubble = waiting ? 1.4 + Math.random() : 4 + Math.random() * 4;
      sfx.bubbles(s.pos.toArray(), waiting ? 0.4 : 0.22);
    }
  });

  const haloTex = useMemo(() => glow('#ff8a3a'), []);

  return (
    <group ref={group} position={FISH_IDLE.toArray()}>
      <mesh geometry={geometry} material={material} />
      <mesh position={[0.045, 0.025, 0.12]} material={eyeMat}>
        <sphereGeometry args={[0.012, 6, 4]} />
      </mesh>
      <mesh position={[-0.045, 0.025, 0.12]} material={eyeMat}>
        <sphereGeometry args={[0.012, 6, 4]} />
      </mesh>
      <sprite scale={[0.9, 0.9, 0.9]}>
        <spriteMaterial ref={halo} map={haloTex} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.55} fog={false} />
      </sprite>
      <pointLight ref={light} color="#ff9a4a" intensity={2.2} distance={3.6} decay={1.5} />
      <Spatial sound={fishVoice()} volume={0.5} refDistance={1.2} rolloff={1.3} />
    </group>
  );
}
