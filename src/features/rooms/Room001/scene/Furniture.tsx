import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { wood } from '@/lib/textures/procedural';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { ARMCHAIR, BED, DRESSER, ROOM, WARDROBE } from '../layout';
import { paintingTex, staticTex } from './textures';

const BRASS = <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} />;

/** Wardrobe, dresser + CRT television, armchair, and the painting above the bed. */
export function Furniture() {
  return (
    <group>
      <Wardrobe />
      <Dresser />
      <Television />
      <Armchair />
      <Painting />
    </group>
  );
}

function Wardrobe() {
  const veneer = wood([1, 2], '#4f3119', 41);
  const { x0, x1, z0, z1, h } = WARDROBE;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const at: [number, number, number] = [x0, 1.2, cz];
  return (
    <Interactable
      label="Ouvrir l’armoire"
      distance={2.4}
      onInteract={() => {
        sfx.creak(at, 0.35);
        ui().showToast('Des cintres vides. Tous tournés vers le mur.');
      }}
    >
      <mesh position={[cx, h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0, h, z1 - z0]} />
        <meshStandardMaterial map={veneer} roughness={0.55} />
      </mesh>
      {/* Crown */}
      <mesh position={[cx - 0.02, h + 0.03, cz]}>
        <boxGeometry args={[x1 - x0 + 0.04, 0.06, z1 - z0 + 0.06]} />
        <meshStandardMaterial map={veneer} roughness={0.5} />
      </mesh>
      {/* Door seam + inset panels */}
      <mesh position={[x0 - 0.002, h / 2 + 0.05, cz]}>
        <boxGeometry args={[0.004, h - 0.2, 0.008]} />
        <meshStandardMaterial color="#1a0e06" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[x0 - 0.006, h / 2 + 0.08, cz + s * 0.3]}>
            <boxGeometry args={[0.01, h - 0.5, 0.42]} />
            <meshStandardMaterial map={wood([1, 2], '#5b3a20', 42)} roughness={0.5} />
          </mesh>
          <mesh position={[x0 - 0.03, 1.15, cz + s * 0.06]}>
            <boxGeometry args={[0.025, 0.16, 0.02]} />
            {BRASS}
          </mesh>
        </group>
      ))}
    </Interactable>
  );
}

function Dresser() {
  const veneer = wood([2, 1], '#5a3820', 43);
  const { x0, x1, z0, z1, h } = DRESSER;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const dz = z1 - z0;
  return (
    <group>
      <mesh position={[cx, h / 2 + 0.04, cz]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0, h - 0.08, dz]} />
        <meshStandardMaterial map={veneer} roughness={0.5} />
      </mesh>
      <mesh position={[cx - 0.01, h - 0.015, cz]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0 + 0.03, 0.03, dz + 0.03]} />
        <meshStandardMaterial map={veneer} roughness={0.35} />
      </mesh>
      {/* Drawer fronts: 3 rows × 2 */}
      {[0.17, 0.38, 0.58].flatMap((y) =>
        [-1, 1].map((s) => (
          <group key={`${y}${s}`} position={[x0 - 0.006, y, cz + s * (dz / 4)]}>
            <mesh>
              <boxGeometry args={[0.012, 0.17, dz / 2 - 0.04]} />
              <meshStandardMaterial map={wood([1, 1], '#63402a', 44)} roughness={0.45} />
            </mesh>
            <mesh position={[-0.015, 0, 0]}>
              <boxGeometry args={[0.02, 0.018, 0.12]} />
              {BRASS}
            </mesh>
          </group>
        )),
      )}
      {/* Hotel ashtray + matchbook: clichés matter. */}
      <mesh position={[cx - 0.05, h + 0.012, z1 - 0.2]}>
        <cylinderGeometry args={[0.06, 0.05, 0.025, 20]} />
        <meshStandardMaterial color="#8a5a1c" metalness={0.3} roughness={0.15} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Television() {
  const tex = staticTex();
  const screen = useRef<MeshStandardMaterial>(null);
  const on = useRef(0);
  const cz = -0.95;
  const top = DRESSER.h;
  const bx = DRESSER.x0 + 0.24;
  const at: [number, number, number] = [bx, top + 0.25, cz];

  useFrame(() => {
    const m = screen.current;
    if (!m) return;
    if (on.current > 0) {
      tex.offset.set(Math.random(), Math.random());
      m.emissiveIntensity = on.current * (0.6 + Math.random() * 0.4);
      on.current = Math.max(0, on.current - 0.012);
    } else m.emissiveIntensity = 0;
  });

  return (
    <Interactable
      label="Allumer la télévision"
      distance={2.6}
      onInteract={() => {
        sfx.click(at, 0.3);
        sfx.glitch(at, 0.12);
        on.current = 1;
        window.setTimeout(() => ui().showToast('Pas de signal. Juste votre reflet — avec une seconde de retard.'), 900);
      }}
    >
      {/* Wood-veneer CRT body facing −X (toward the bed). */}
      <mesh position={[bx, top + 0.22, cz]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.56]} />
        <meshStandardMaterial map={wood([1, 1], '#3a2412', 45)} roughness={0.5} />
      </mesh>
      <mesh position={[bx - 0.212, top + 0.235, cz - 0.05]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.38, 0.3]} />
        <meshStandardMaterial
          ref={screen}
          color="#0d1210"
          roughness={0.12}
          metalness={0.4}
          emissive="#cfe3d8"
          emissiveMap={tex}
          emissiveIntensity={0}
        />
      </mesh>
      {/* Knobs */}
      {[0.08, -0.02].map((dy) => (
        <mesh key={dy} position={[bx - 0.215, top + 0.25 + dy, cz + 0.21]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.018, 0.018, 0.02, 14]} />
          <meshStandardMaterial color="#1a1a18" roughness={0.5} />
        </mesh>
      ))}
      {/* Rabbit ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[bx + 0.02, top + 0.62, cz + s * 0.1]} rotation-x={s * 0.45}>
          <cylinderGeometry args={[0.003, 0.003, 0.4, 6]} />
          <meshStandardMaterial color="#bbb" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </Interactable>
  );
}

function Armchair() {
  const fabric = <meshStandardMaterial color="#8c4520" roughness={0.95} />;
  const { x, z, s } = ARMCHAIR;
  return (
    <Interactable
      label="Le fauteuil"
      distance={2.4}
      onInteract={() => ui().showToast('Le velours est encore tiède. Et creusé, comme si quelqu’un venait de se lever.')}
      position={[x, 0, z]}
      rotation={[0, -0.72, 0]}
    >
      {/* Local frame: facing +Z. */}
      <mesh position={[0, 0.28, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[s - 0.2, 0.16, s - 0.12]} />
        {fabric}
      </mesh>
      <mesh position={[0, 0.62, -s / 2 + 0.08]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[s - 0.1, 0.68, 0.14]} />
        {fabric}
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * (s / 2 - 0.06), 0.4, 0]} castShadow>
          <boxGeometry args={[0.12, 0.34, s - 0.06]} />
          {fabric}
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[s - 0.06, 0.16, s - 0.06]} />
        <meshStandardMaterial map={wood([1, 1], '#3a2412', 46)} roughness={0.6} />
      </mesh>
    </Interactable>
  );
}

function Painting() {
  const z = (BED.z0 + BED.z1) / 2;
  return (
    <Interactable
      label="Le tableau"
      distance={3.4}
      onInteract={() =>
        ui().showToast('Une chambre d’hôtel. Un lit défait, une lampe allumée. Près de la porte, une silhouette. Vous vérifiez : personne.')
      }
      position={[ROOM.x0 + 0.03, 1.98, z]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh castShadow>
        <boxGeometry args={[0.92, 0.66, 0.04]} />
        <meshStandardMaterial color="#8a6a2e" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[0.8, 0.55]} />
        <meshStandardMaterial map={paintingTex()} roughness={0.6} />
      </mesh>
    </Interactable>
  );
}
