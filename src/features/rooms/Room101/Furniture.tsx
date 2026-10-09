import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type Group, type InstancedMesh, type Mesh } from 'three';
import { wood } from '@/lib/textures/procedural';
import { Interactable } from '@/lib/interaction/Interactable';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { blanketTexture } from './textures';
import { fx, isSeen } from './state';
import { BED, CHEST, NIGHTSTAND, WARDROBE } from './layout';

const WHITE = '#f4efe6';

/** Child's bed with bars on three sides. Under it: darkness, dust and the teddy. */
export function Bed() {
  const bars = useRef<InstancedMesh>(null);
  const blanket = useMemo(blanketTexture, []);
  const cx = (BED.x0 + BED.x1) / 2;
  const cz = (BED.z0 + BED.z1) / 2;
  const w = BED.x1 - BED.x0;
  const l = BED.z1 - BED.z0;

  // Bar positions: room side (x = x1) + head + foot.
  const barList = useMemo(() => {
    const out: [number, number, number][] = [];
    const n = 15;
    for (let i = 1; i < n; i++) out.push([BED.x1 - 0.02, 0, BED.z0 + (l * i) / n]);
    for (let i = 1; i < 6; i++) {
      out.push([BED.x0 + (w * i) / 6, 0, BED.z0 + 0.02]);
      out.push([BED.x0 + (w * i) / 6, 0, BED.z1 - 0.02]);
    }
    return out;
  }, [l, w]);

  useLayoutEffect(() => {
    const m = bars.current;
    if (!m) return;
    const o = new Object3D();
    const h = BED.rail - BED.base;
    barList.forEach(([x, , z], i) => {
      o.position.set(x, BED.base + h / 2, z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [barList]);

  const posts: [number, number][] = [
    [BED.x0 + 0.02, BED.z0 + 0.02],
    [BED.x1 - 0.02, BED.z0 + 0.02],
    [BED.x0 + 0.02, BED.z1 - 0.02],
    [BED.x1 - 0.02, BED.z1 - 0.02],
  ];

  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, (BED.rail + 0.06) / 2, z]} castShadow>
          <boxGeometry args={[0.05, BED.rail + 0.06, 0.05]} />
          <meshStandardMaterial color={WHITE} roughness={0.45} />
        </mesh>
      ))}
      {/* Slatted base (the under-bed "ceiling") */}
      <mesh position={[cx, BED.base + 0.025, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.05, l]} />
        <meshStandardMaterial color="#d9cfbf" roughness={0.7} />
      </mesh>
      {/* Side boards hiding the slats */}
      <mesh position={[BED.x1 - 0.02, BED.base + 0.02, cz]} castShadow>
        <boxGeometry args={[0.03, 0.09, l]} />
        <meshStandardMaterial color={WHITE} roughness={0.45} />
      </mesh>
      {/* Mattress */}
      <mesh position={[cx, (BED.base + 0.05 + BED.mattress) / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.06, BED.mattress - BED.base - 0.05, l - 0.06]} />
        <meshStandardMaterial color="#dfe9f2" roughness={0.9} />
      </mesh>
      {/* Blanket, folded back, one edge hanging over the room-side rail */}
      <mesh position={[cx, BED.mattress + 0.02, cz + 0.2]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.04, 0.04, l * 0.62]} />
        <meshStandardMaterial map={blanket} roughness={1} />
      </mesh>
      {/* Pillow */}
      <mesh position={[cx, BED.mattress + 0.05, BED.z0 + 0.22]} scale={[1, 0.35, 0.6]} castShadow>
        <sphereGeometry args={[0.25, 20, 12]} />
        <meshStandardMaterial color="#fbf6ee" roughness={1} />
      </mesh>
      {/* Top rails */}
      <mesh position={[BED.x1 - 0.02, BED.rail, cz]} castShadow>
        <boxGeometry args={[0.045, 0.045, l]} />
        <meshStandardMaterial color={WHITE} roughness={0.45} />
      </mesh>
      {[BED.z0 + 0.02, BED.z1 - 0.02].map((z) => (
        <mesh key={z} position={[cx, BED.rail, z]} castShadow>
          <boxGeometry args={[w, 0.045, 0.045]} />
          <meshStandardMaterial color={WHITE} roughness={0.45} />
        </mesh>
      ))}
      {/* Bars (instanced) */}
      <instancedMesh ref={bars} args={[undefined, undefined, barList.length]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, BED.rail - BED.base, 8]} />
        <meshStandardMaterial color={WHITE} roughness={0.45} />
      </instancedMesh>
      {/* Under-bed clutter: a shoebox and a dust bunny */}
      <mesh position={[-2.0, 0.06, -0.7]} rotation-y={0.3} castShadow>
        <boxGeometry args={[0.28, 0.12, 0.18]} />
        <meshStandardMaterial color="#8a5c5c" roughness={0.9} />
      </mesh>
      <mesh position={[-1.6, 0.02, -1.6]}>
        <sphereGeometry args={[0.03, 6, 4]} />
        <meshStandardMaterial color="#888" roughness={1} />
      </mesh>
      <Mobile />
    </group>
  );
}

/** Star mobile hanging over the bed. Turns one way… then, later, the other. */
function Mobile() {
  const ref = useRef<Group>(null);
  const cx = (BED.x0 + BED.x1) / 2;
  const cz = BED.z0 + 0.45;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const dir = fx.uneaseOn && fx.unease > 30 ? -1 : 1;
    const speed = fx.reducedMotion ? 0.06 : 0.18;
    ref.current.rotation.y += dt * speed * dir * (1 - fx.dying);
  });
  const shapes = ['#f2d27a', '#a9c4e4', '#efc4cf', '#f2d27a', '#c7a0e0'];
  return (
    <group position={[cx, 1.55, cz]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 1.0, 4]} />
        <meshStandardMaterial color="#ccc" />
      </mesh>
      <group ref={ref}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.2, 0.006, 6, 32]} />
          <meshStandardMaterial color="#e8dcc0" />
        </mesh>
        {shapes.map((c, i) => {
          const a = (i / shapes.length) * Math.PI * 2;
          const len = 0.12 + (i % 2) * 0.08;
          return (
            <group key={i} position={[Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2]}>
              <mesh position={[0, -len / 2, 0]}>
                <cylinderGeometry args={[0.002, 0.002, len, 3]} />
                <meshStandardMaterial color="#ddd" />
              </mesh>
              <mesh position={[0, -len - 0.04, 0]} rotation-y={a} castShadow>
                {i % 2 ? <octahedronGeometry args={[0.04, 0]} /> : <icosahedronGeometry args={[0.035, 0]} />}
                <meshStandardMaterial color={c} roughness={0.6} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

export function Nightstand() {
  return (
    <group position={[NIGHTSTAND.x, 0, NIGHTSTAND.z]}>
      <mesh position={[0, NIGHTSTAND.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, NIGHTSTAND.h, 0.38]} />
        <meshStandardMaterial color="#c9dbe8" roughness={0.6} />
      </mesh>
      <mesh position={[0.205, NIGHTSTAND.h * 0.62, 0]}>
        <boxGeometry args={[0.01, 0.16, 0.3]} />
        <meshStandardMaterial color="#b6cad8" roughness={0.6} />
      </mesh>
      <mesh position={[0.215, NIGHTSTAND.h * 0.62, 0]}>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshStandardMaterial color="#f2d27a" roughness={0.4} />
      </mesh>
      {/* Children's book */}
      <mesh position={[0.05, NIGHTSTAND.h + 0.012, -0.1]} rotation-y={0.4}>
        <boxGeometry args={[0.16, 0.022, 0.2]} />
        <meshStandardMaterial color="#d1505a" roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Wardrobe, right door ajar. After the teddy is taken the gap widens when you
 * look away, and later two pale dots wait in the dark — they vanish once seen.
 */
export function Wardrobe() {
  const door = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const state = useRef({ open: 0.22, target: 0.22, eyesOn: false, seenFor: 0 });
  const tex = useMemo(() => wood([1, 2], '#e9d8bd', 33), []);
  const w = WARDROBE.x1 - WARDROBE.x0;
  const d = WARDROBE.z1 - WARDROBE.z0;
  const cz = (WARDROBE.z0 + WARDROBE.z1) / 2;
  const frontX = WARDROBE.x0;
  const eyePos: [number, number, number] = [frontX - 0.004, 1.42, cz + 0.08];

  useFrame(({ camera }, dt) => {
    const s = state.current;
    const seen = isSeen(camera, [frontX, 1.2, cz]);
    if (fx.uneaseOn && fx.dying === 0) {
      if (!seen && fx.unease > 15) s.target = Math.min(0.62, 0.22 + (fx.unease - 15) / 120);
      if (!seen && fx.unease > 45 && !s.eyesOn && s.seenFor === 0) s.eyesOn = true;
      if (s.eyesOn && seen) {
        s.seenFor += dt;
        if (s.seenFor > 1.1) s.eyesOn = false;
      } else if (!seen) s.seenFor = 0;
    }
    if (!seen) s.open += (s.target - s.open) * (1 - Math.exp(-dt * 2));
    if (door.current) door.current.rotation.y = s.open;
    if (eyes.current) eyes.current.visible = s.eyesOn && fx.dying === 0;
  });

  return (
    <group>
      {/* Carcass */}
      <mesh position={[(WARDROBE.x0 + WARDROBE.x1) / 2 + 0.01, WARDROBE.h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.02, WARDROBE.h, d]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {/* Dark interior visible through the gap */}
      <mesh position={[frontX - 0.001, WARDROBE.h / 2 + 0.05, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[d - 0.06, WARDROBE.h - 0.2]} />
        <meshBasicMaterial color="#030203" />
      </mesh>
      {/* Left door (closed) */}
      <mesh position={[frontX - 0.012, WARDROBE.h / 2 + 0.05, WARDROBE.z0 + d / 4]} castShadow>
        <boxGeometry args={[0.024, WARDROBE.h - 0.14, d / 2 - 0.01]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      {/* Right door (ajar) — hinge at z1 */}
      <group ref={door} position={[frontX - 0.012, 0, WARDROBE.z1]}>
        <mesh position={[0, WARDROBE.h / 2 + 0.05, -d / 4]} castShadow>
          <boxGeometry args={[0.024, WARDROBE.h - 0.14, d / 2 - 0.01]} />
          <meshStandardMaterial map={tex} roughness={0.55} />
        </mesh>
        <mesh position={[-0.02, 1.0, -d / 2 + 0.05]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <meshStandardMaterial color="#c9a45a" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[frontX - 0.03, 1.0, WARDROBE.z0 + d / 2 - 0.05]}>
        <sphereGeometry args={[0.02, 10, 8]} />
        <meshStandardMaterial color="#c9a45a" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Crown */}
      <mesh position={[(WARDROBE.x0 + WARDROBE.x1) / 2 - 0.01, WARDROBE.h + 0.03, cz]}>
        <boxGeometry args={[w + 0.04, 0.06, d + 0.06]} />
        <meshStandardMaterial color="#efe3cc" roughness={0.6} />
      </mesh>
      {/* Eyes in the gap */}
      <group ref={eyes} position={eyePos} visible={false}>
        {[-0.035, 0.035].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation-y={-Math.PI / 2}>
            <circleGeometry args={[0.009, 10]} />
            <meshBasicMaterial color="#e8e2d0" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Interactable
        label="L’armoire"
        distance={2.2}
        onInteract={() => {
          sfx.creak([frontX, 1.2, cz], 0.35);
          ui().showToast(fx.uneaseOn ? 'Vous la refermez. Elle se rouvre. Doucement.' : 'Entrouverte. Vous n’avez pas envie de l’ouvrir davantage.');
          state.current.open = state.current.target = 0.05;
        }}
        position={[frontX - 0.03, 1.0, cz]}
      >
        <mesh visible={false}>
          <boxGeometry args={[0.04, 1.7, d]} />
          <meshBasicMaterial />
        </mesh>
      </Interactable>
    </group>
  );
}

/** Toy chest under the drawings. The music box sits on it. */
export function ToyChest() {
  const lid = useRef<Mesh>(null);
  const w = CHEST.x1 - CHEST.x0;
  const d = CHEST.z1 - CHEST.z0;
  const cx = (CHEST.x0 + CHEST.x1) / 2;
  const cz = (CHEST.z0 + CHEST.z1) / 2;
  return (
    <group>
      <mesh position={[cx, CHEST.h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, CHEST.h - 0.02, d]} />
        <meshStandardMaterial color="#a9c4e4" roughness={0.65} />
      </mesh>
      <mesh ref={lid} position={[cx, CHEST.h, cz]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.03, 0.03, d + 0.03]} />
        <meshStandardMaterial color="#f4efe6" roughness={0.5} />
      </mesh>
      {/* Painted hearts */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={x} position={[cx + x, CHEST.h * 0.5, CHEST.z1 + 0.001]}>
          <circleGeometry args={[0.06, 20]} />
          <meshStandardMaterial color={['#efc4cf', '#f2d27a', '#9ed69a'][i]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
