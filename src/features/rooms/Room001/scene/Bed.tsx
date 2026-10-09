import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { AdditiveBlending, DoubleSide, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { glow, wood } from '@/lib/textures/procedural';
import { BED, KEY_PILLOW, ROOM } from '../layout';
import { useR1 } from '../useRoom001';
import { createDuvetGeometry } from './duvet';
import { duvetTex, writingTex } from './textures';

const CX = (BED.x0 + BED.x1) / 2;
const CZ = (BED.z0 + BED.z1) / 2;
const HX = (BED.x1 - BED.x0) / 2;
const HZ = (BED.z1 - BED.z0) / 2;
const MATTRESS_TOP = BED.top - 0.02;

/** Unmade bed, pillows (one hides the fragment), the glowing writing above it. */
export function Bed() {
  const duvet = useMemo(() => createDuvetGeometry(HX - 0.02, HZ - 0.02), []);
  useEffect(() => () => duvet.dispose(), [duvet]);

  return (
    <group>
      {/* Frame / plinth */}
      <mesh position={[CX, 0.17, CZ]} castShadow receiveShadow>
        <boxGeometry args={[HX * 2, 0.26, HZ * 2]} />
        <meshStandardMaterial map={wood([2, 1], '#4a2a16', 21)} roughness={0.6} />
      </mesh>
      <mesh position={[CX, 0.02, CZ]}>
        <boxGeometry args={[HX * 2 - 0.1, 0.04, HZ * 2 - 0.1]} />
        <meshStandardMaterial color="#120a06" roughness={1} />
      </mesh>
      {/* Mattress + fitted sheet */}
      <mesh position={[CX, 0.3 + (MATTRESS_TOP - 0.3) / 2, CZ]} castShadow receiveShadow>
        <boxGeometry args={[HX * 2 - 0.04, MATTRESS_TOP - 0.3, HZ * 2 - 0.04]} />
        <meshStandardMaterial color="#e6dac2" roughness={0.95} />
      </mesh>
      {/* Duvet */}
      <mesh geometry={duvet} position={[CX, MATTRESS_TOP, CZ]} castShadow receiveShadow>
        <meshStandardMaterial map={duvetTex()} roughness={0.92} side={DoubleSide} />
      </mesh>

      <Headboard />
      <Pillow position={[KEY_PILLOW[0], KEY_PILLOW[1], CZ + 0.4]} rot={0.12} />
      <KeyPillow />
      <Fragment />
      <Writing />
    </group>
  );
}

/** Tufted velvet headboard against the wall. */
function Headboard() {
  const x = ROOM.x0 + 0.04;
  return (
    <group position={[x, 0, (BED.z0 + BED.z1) / 2]}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.07, 0.95, HZ * 2 + 0.16]} />
        <meshStandardMaterial color="#4b2a1d" roughness={0.85} />
      </mesh>
      {/* Vertical channels */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0.038, 0.72, -HZ + 0.1 + (i * (HZ * 2 - 0.2)) / 5]}>
          <boxGeometry args={[0.012, 0.85, 0.012]} />
          <meshStandardMaterial color="#2a160e" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0.01, 1.215, 0]}>
        <boxGeometry args={[0.1, 0.04, HZ * 2 + 0.2]} />
        <meshStandardMaterial map={wood([2, 1], '#4a2a16', 22)} roughness={0.5} />
      </mesh>
    </group>
  );
}

function PillowMesh() {
  return (
    <mesh scale={[0.21, 0.075, 0.33]} castShadow receiveShadow>
      <sphereGeometry args={[1, 28, 16]} />
      <meshStandardMaterial color="#efe6d4" roughness={0.95} />
    </mesh>
  );
}

function Pillow({ position, rot }: { position: [number, number, number]; rot: number }) {
  return (
    <group position={position} rotation={[0.08, rot, -0.18]}>
      <PillowMesh />
    </group>
  );
}

/** The pillow over the fragment: lifts on interaction, stays aside once revealed. */
function KeyPillow() {
  const { s, liftPillow } = useR1();
  const g = useRef<Group>(null);
  const prevNonce = useRef(s.pillowNonce);

  useEffect(() => {
    // Only animate on an actual lift (StrictMode-safe: no animation at mount).
    if (s.pillowNonce === prevNonce.current) return;
    prevNonce.current = s.pillowNonce;
    const o = g.current;
    if (!o) return;
    gsap.killTweensOf([o.position, o.rotation]);
    if (s.keyRevealed) {
      gsap.to(o.position, { x: KEY_PILLOW[0] + 0.1, y: KEY_PILLOW[1] + 0.09, z: KEY_PILLOW[2] + 0.34, duration: 0.7, ease: 'power3.out' });
      gsap.to(o.rotation, { x: 0.3, z: -0.5, duration: 0.7, ease: 'power3.out' });
    } else {
      gsap
        .timeline()
        .to(o.position, { y: KEY_PILLOW[1] + 0.2, duration: 0.35, ease: 'power2.out' })
        .to(o.rotation, { x: -0.35, duration: 0.35, ease: 'power2.out' }, 0)
        .to(o.position, { y: KEY_PILLOW[1], duration: 0.4, ease: 'bounce.out', delay: 0.35 })
        .to(o.rotation, { x: 0, duration: 0.4 }, '<');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pillowNonce]);

  return (
    <Interactable
      label="Soulever l’oreiller"
      distance={2.6}
      disabled={s.keyRevealed}
      onInteract={liftPillow}
    >
      <group ref={g} position={KEY_PILLOW}>
        <PillowMesh />
      </group>
    </Interactable>
  );
}

/**
 * The fragment "1": a small brass key whose bow frames the numeral.
 * Before it is revealed, only its glow leaks around the pillow — and only in the dark,
 * once the note has been read.
 */
function Fragment() {
  const { s, levels, takeKey } = useR1();
  const halo = useRef<MeshBasicMaterial>(null);
  const brass = useRef<MeshStandardMaterial>(null);
  const key = useRef<Group>(null);
  const haloTex = useMemo(() => glow('#ffc46b'), []);
  const base: [number, number, number] = [KEY_PILLOW[0] + 0.02, MATTRESS_TOP + 0.03, KEY_PILLOW[2]];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const dark = (1 - levels.lamp) * (1 - levels.exit);
    const armed = s.noteRead && !s.keyTaken;
    if (halo.current) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.1);
      const target = armed ? dark * (s.keyRevealed ? 0.7 : 0.55) * pulse + (s.keyRevealed ? 0.15 : 0) : 0;
      halo.current.opacity += (target - halo.current.opacity) * 0.1;
    }
    if (brass.current) brass.current.emissiveIntensity = 0.35 + 2.4 * dark + 0.3 * Math.sin(t * 2.1);
    if (key.current) {
      key.current.position.y = base[1] + 0.02 + Math.sin(t * 1.6) * 0.01;
      key.current.rotation.y = t * 0.4;
    }
  });

  return (
    <group>
      {/* Glow pool on the sheet, wider than the pillow so it leaks around it. */}
      <mesh position={[base[0], MATTRESS_TOP + 0.012, base[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.95, 1.05]} />
        <meshBasicMaterial
          ref={halo}
          map={haloTex}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {s.keyRevealed && !s.keyTaken && (
        <Interactable label="Prendre le fragment" distance={2.6} onInteract={takeKey}>
          <group ref={key} position={base} rotation={[0, 0, 0]}>
            <group rotation={[0, 0, Math.PI / 2]} scale={1.15}>
              {/* Bow ring */}
              <mesh position={[0, 0.07, 0]}>
                <torusGeometry args={[0.045, 0.009, 10, 32]} />
                <meshStandardMaterial ref={brass} color="#c99a45" metalness={0.85} roughness={0.28} emissive="#ffae42" emissiveIntensity={1} />
              </mesh>
              {/* Numeral "1" inside the bow */}
              <mesh position={[0.004, 0.07, 0]}>
                <boxGeometry args={[0.01, 0.055, 0.008]} />
                <meshStandardMaterial color="#ffe1a0" emissive="#ffc46b" emissiveIntensity={3} toneMapped={false} />
              </mesh>
              <mesh position={[-0.008, 0.088, 0]} rotation-z={-0.8}>
                <boxGeometry args={[0.008, 0.022, 0.008]} />
                <meshStandardMaterial color="#ffe1a0" emissive="#ffc46b" emissiveIntensity={3} toneMapped={false} />
              </mesh>
              {/* Shaft */}
              <mesh position={[0, -0.03, 0]}>
                <cylinderGeometry args={[0.007, 0.007, 0.15, 10]} />
                <meshStandardMaterial color="#c99a45" metalness={0.85} roughness={0.3} emissive="#ffae42" emissiveIntensity={0.6} />
              </mesh>
              {/* Bit / teeth */}
              {[-0.085, -0.06].map((y, i) => (
                <mesh key={y} position={[0.016, y, 0]}>
                  <boxGeometry args={[0.022, i ? 0.012 : 0.016, 0.007]} />
                  <meshStandardMaterial color="#c99a45" metalness={0.85} roughness={0.3} emissive="#ffae42" emissiveIntensity={0.6} />
                </mesh>
              ))}
            </group>
          </group>
        </Interactable>
      )}
    </group>
  );
}

/** Phosphorescent handwriting on the wall above the pillows — only readable in the dark. */
function Writing() {
  const { levels } = useR1();
  const mat = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const dark = 1 - levels.lamp;
    const breathe = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 0.8);
    mat.current.opacity = dark * dark * 0.85 * breathe * (1 - levels.exit);
  });
  return (
    <mesh position={[ROOM.x0 + 0.005, 1.43, KEY_PILLOW[2]]} rotation-y={Math.PI / 2}>
      <planeGeometry args={[0.42, 0.42]} />
      <meshBasicMaterial
        ref={mat}
        map={writingTex()}
        color="#9dffcf"
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
