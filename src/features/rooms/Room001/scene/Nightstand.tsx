import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { DoubleSide, type Group, type MeshStandardMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { wood } from '@/lib/textures/procedural';
import { NIGHTSTAND } from '../layout';
import { useR1 } from '../useRoom001';
import { paperTex } from './textures';

const D = NIGHTSTAND.d;
const W = NIGHTSTAND.w;
const H = NIGHTSTAND.h;
const OPEN = 0.27;

/** Bedside table (drawer faces +X) with the drawer, the note and the lamp. */
export function Nightstand() {
  const veneer = wood([1, 1], '#5a3820', 31);
  const mat = <meshStandardMaterial map={veneer} roughness={0.5} />;
  return (
    <group position={[NIGHTSTAND.x, 0, NIGHTSTAND.z]}>
      {/* Carcass */}
      <mesh position={[0, H - 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[D + 0.02, 0.03, W + 0.02]} />
        {mat}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (H - 0.03) / 2 + 0.02, s * (W / 2 - 0.01)]} castShadow receiveShadow>
          <boxGeometry args={[D, H - 0.03 - 0.02, 0.02]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[-D / 2 + 0.01, H / 2, 0]}>
        <boxGeometry args={[0.02, H - 0.04, W - 0.02]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[D, 0.03, W - 0.02]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.355, 0]} receiveShadow>
        <boxGeometry args={[D, 0.02, W - 0.02]} />
        {mat}
      </mesh>
      {/* Lower niche: a hotel bible, as it should be. */}
      <mesh position={[0.02, 0.1, 0.08]} rotation-y={0.12} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.23]} />
        <meshStandardMaterial color="#3a1414" roughness={0.7} />
      </mesh>
      {/* Legs */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (D / 2 - 0.03), 0.022, sz * (W / 2 - 0.03)]}>
            <cylinderGeometry args={[0.015, 0.01, 0.045, 8]} />
            <meshStandardMaterial color="#1a0f08" />
          </mesh>
        )),
      )}

      <Drawer />
      <Lamp />
    </group>
  );
}

function Drawer() {
  const { s, toggleDrawer, readNote } = useR1();
  const g = useRef<Group>(null);
  const veneer = wood([1, 1], '#63402a', 32);

  useEffect(() => {
    if (!g.current) return;
    gsap.to(g.current.position, { x: s.drawerOpen ? OPEN : 0, duration: 0.55, ease: s.drawerOpen ? 'power3.out' : 'power2.inOut' });
  }, [s.drawerOpen]);

  const y0 = 0.37;
  const inner = { d: D - 0.06, w: W - 0.06, h: 0.11 };
  return (
    <group ref={g}>
      <Interactable label={s.drawerOpen ? 'Fermer le tiroir' : 'Ouvrir le tiroir'} distance={2.3} onInteract={toggleDrawer}>
        <mesh position={[D / 2 - 0.01, y0 + 0.085, 0]} castShadow>
          <boxGeometry args={[0.025, 0.16, W - 0.03]} />
          <meshStandardMaterial map={veneer} roughness={0.45} />
        </mesh>
        <mesh position={[D / 2 + 0.012, y0 + 0.085, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.016, 0.025, 14]} />
          <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.25} />
        </mesh>
      </Interactable>
      {/* Box */}
      <mesh position={[0, y0 + 0.005, 0]} receiveShadow>
        <boxGeometry args={[inner.d, 0.01, inner.w]} />
        <meshStandardMaterial color="#6e5038" roughness={0.8} />
      </mesh>
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, y0 + inner.h / 2, sz * (inner.w / 2)]}>
          <boxGeometry args={[inner.d, inner.h, 0.01]} />
          <meshStandardMaterial color="#6e5038" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-inner.d / 2, y0 + inner.h / 2, 0]}>
        <boxGeometry args={[0.01, inner.h, inner.w]} />
        <meshStandardMaterial color="#6e5038" roughness={0.8} />
      </mesh>
      {/* The folded note */}
      <Interactable label="Lire le papier" distance={2.2} disabled={!s.drawerOpen} onInteract={readNote}>
        <group position={[0.06, y0 + 0.012, 0.02]} rotation={[0, 0.35, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.045]}>
            <planeGeometry args={[0.13, 0.09]} />
            <meshStandardMaterial map={paperTex()} roughness={0.9} side={DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2 + 0.25, 0, 0]} position={[0, 0.011, 0.044]}>
            <planeGeometry args={[0.13, 0.09]} />
            <meshStandardMaterial color="#e8dec8" roughness={0.9} side={DoubleSide} />
          </mesh>
        </group>
      </Interactable>
    </group>
  );
}

/** Ginger-jar ceramic lamp with a pleated paper shade. The light itself lives in <Lighting/>. */
function Lamp() {
  const { s, levels, toggleLamp } = useR1();
  const shade = useRef<MeshStandardMaterial>(null);
  const bulb = useRef<MeshStandardMaterial>(null);

  useFrame(() => {
    const l = levels.lamp * levels.flicker * (1 - levels.exit);
    if (shade.current) shade.current.emissiveIntensity = 0.05 + 1.1 * l;
    if (bulb.current) bulb.current.emissiveIntensity = 6 * l;
  });

  return (
    <Interactable
      label={s.lampOn ? 'Éteindre la lampe' : 'Allumer la lampe'}
      distance={2.6}
      onInteract={toggleLamp}
      position={[-0.03, H, 0]}
    >
      {/* Ceramic jar */}
      <mesh position={[0, 0.12, 0]} scale={[1, 1.15, 1]} castShadow>
        <sphereGeometry args={[0.095, 28, 18]} />
        <meshStandardMaterial color="#2f5a52" roughness={0.18} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.03, 24]} />
        <meshStandardMaterial color="#c79a45" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 8]} />
        <meshStandardMaterial color="#c79a45" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Bulb */}
      <mesh position={[0, 0.41, 0]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshStandardMaterial ref={bulb} color="#fff3d6" emissive="#ffc47a" emissiveIntensity={6} toneMapped={false} />
      </mesh>
      {/* Shade (open-ended so the light spills up and down; doesn't cast shadows). */}
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.12, 0.19, 0.22, 36, 1, true]} />
        <meshStandardMaterial ref={shade} color="#ead6ad" emissive="#ffb35e" emissiveIntensity={1.1} roughness={0.9} side={DoubleSide} />
      </mesh>
    </Interactable>
  );
}
