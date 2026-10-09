import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Physics, RigidBody, CuboidCollider, CylinderCollider, CapsuleCollider, interactionGroups,
  type RapierRigidBody, type CollisionEnterPayload,
} from '@react-three/rapier';
import { Text } from '@react-three/drei';
import { player } from '@/features/hub/playerState';
import { Interactable } from '@/lib/interaction/Interactable';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { FONT_MONO } from '@/lib/loaders/fonts';
import type { Vec3 } from '@/types/game';
import { H, HALF_W, HALF_D, BED, TABLE, WARDROBE, NIGHTSTANDS, NIGHTSTAND, CHANDELIER, KEY_WORLD, toWorld } from './layout';
import { KeyModel } from './KeyModel';

/** Collision groups: the player's pusher never touches the key (so you can't kick it away). */
const G_PUSHER = interactionGroups(1, [0]);
const G_KEY = interactionGroups(2, [0]);

type Sound = 'soft' | 'thud' | 'clink';

let lastGlobalSound = 0;
function impact(body: RapierRigidBody | undefined, kind: Sound) {
  if (!body) return;
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed < 0.9) return;
  const now = performance.now();
  if (now - lastGlobalSound < 45) return;
  lastGlobalSound = now;
  const p = body.translation();
  const at: Vec3 = [p.x, p.y, p.z];
  const vol = Math.min(speed / 6, 1);
  if (kind === 'soft') sfx.thud(at, vol * 0.25);
  else if (kind === 'thud') sfx.thud(at, vol * 0.7);
  else sfx.click(at, vol * 0.6);
}

interface LooseProps {
  position: Vec3;
  rotation?: Vec3;
  sound: Sound;
  mass?: number;
  restitution?: number;
  colliders?: 'cuboid' | 'ball' | 'hull';
  bodies: React.MutableRefObject<RapierRigidBody[]>;
  children: ReactNode;
}

/** A loose object that obeys the new gravity (and, at the exit, the old one). */
function Loose({ position, rotation, sound, mass = 0.5, restitution = 0.2, colliders = 'cuboid', bodies, children }: LooseProps) {
  return (
    <RigidBody
      ref={(rb: RapierRigidBody | null) => {
        if (rb && !bodies.current.includes(rb)) bodies.current.push(rb);
      }}
      position={position}
      rotation={rotation}
      colliders={colliders}
      mass={mass}
      restitution={restitution}
      friction={0.7}
      linearDamping={0.15}
      angularDamping={0.4}
      onCollisionEnter={(e: CollisionEnterPayload) => impact(e.target.rigidBody, sound)}
    >
      {children}
    </RigidBody>
  );
}

export interface GravityProps {
  /** Physics frozen until the arrival "flip" (curtain + intro hold). */
  running: boolean;
  /** At the exit, gravity reverts: everything falls back to the real floor. */
  reverted: boolean;
  keyReleased: boolean;
  keyTaken: boolean;
  onTakeKey: () => void;
  onKeyLanded: () => void;
}

/**
 * World-space physics. The room is flipped, so plain −Y gravity already pulls
 * everything toward the ceiling = the player's floor. At the exit we invert it.
 */
export function Gravity({ running, reverted, keyReleased, keyTaken, onTakeKey, onKeyLanded }: GravityProps) {
  const bodies = useRef<RapierRigidBody[]>([]);
  const wasReverted = useRef(false);

  useFrame(() => {
    if (reverted && !wasReverted.current) {
      wasReverted.current = true;
      bodies.current.forEach((b) => b.wakeUp());
    }
  });

  return (
    <Physics gravity={[0, reverted ? 6 : -9.81, 0]} paused={!running} timeStep={1 / 60}>
      <Shell />
      <Pusher />
      <LooseObjects bodies={bodies} />
      {keyReleased && !keyTaken && <FallingKey onTake={onTakeKey} onLanded={onKeyLanded} />}
    </Physics>
  );
}

/** Static colliders: both floors, the four walls, the chandelier column, hanging furniture. */
function Shell() {
  const ch = toWorld(CHANDELIER.x, 0, CHANDELIER.z);
  const wr = toWorld(WARDROBE.x, 0, WARDROBE.z);
  const bed = toWorld(BED.x, 0, BED.z);
  const tb = toWorld(TABLE.x, 0, TABLE.z);
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[HALF_W + 0.5, 0.1, HALF_D + 0.5]} position={[0, -0.1, 0]} />
      <CuboidCollider args={[HALF_W + 0.5, 0.1, HALF_D + 0.5]} position={[0, H + 0.1, 0]} />
      <CuboidCollider args={[0.1, H, HALF_D + 0.5]} position={[-HALF_W - 0.1, H / 2, 0]} />
      <CuboidCollider args={[0.1, H, HALF_D + 0.5]} position={[HALF_W + 0.1, H / 2, 0]} />
      <CuboidCollider args={[HALF_W + 0.5, H, 0.1]} position={[0, H / 2, -HALF_D - 0.1]} />
      <CuboidCollider args={[HALF_W + 0.5, H, 0.1]} position={[0, H / 2, HALF_D + 0.1]} />
      <CylinderCollider args={[CHANDELIER.drop / 2, 0.32]} position={[ch[0], CHANDELIER.drop / 2, ch[2]]} />
      {/* Hanging furniture (matters on the way back up at the exit) */}
      <CuboidCollider args={[WARDROBE.w / 2, WARDROBE.h / 2, WARDROBE.d / 2]} position={[wr[0], H - WARDROBE.h / 2, wr[2]]} />
      <CuboidCollider args={[BED.w / 2, BED.top / 2, BED.l / 2]} position={[bed[0], H - BED.top / 2, bed[2]]} />
      <CuboidCollider args={[TABLE.w / 2, 0.02, TABLE.d / 2]} position={[tb[0], H - TABLE.h + 0.02, tb[2]]} />
    </RigidBody>
  );
}

/** Kinematic capsule glued to the player's feet: walking into things knocks them. */
function Pusher() {
  const ref = useRef<RapierRigidBody>(null);
  useFrame(() => {
    const p = player.position;
    const crouch = player.crouchAmount;
    ref.current?.setNextKinematicTranslation({ x: p.x, y: p.y + 0.55 - crouch * 0.2, z: p.z });
  });
  return (
    <RigidBody ref={ref} type="kinematicPosition" colliders={false} position={[0, 0.55, 2.8]} collisionGroups={G_PUSHER}>
      <CapsuleCollider args={[0.3, 0.25]} collisionGroups={G_PUSHER} />
    </RigidBody>
  );
}

// ── The loose things: pillows, books, cups, fruit, shoes, a suitcase ───────
function LooseObjects({ bodies }: { bodies: React.MutableRefObject<RapierRigidBody[]> }) {
  const items = useMemo(() => {
    const top = BED.top + 0.12;
    const tableTop = TABLE.h + 0.06;
    const nsTop = NIGHTSTAND.h + 0.04;
    const [nsL, nsR] = NIGHTSTANDS;
    const book = ['#6b1e2c', '#1f3d36', '#2a2f52', '#8a6a2a', '#3c2418', '#45522e'];
    return {
      pillows: [toWorld(-0.42, top, -3.55), toWorld(0.42, top, -3.55)],
      books: [
        toWorld(TABLE.x - 0.3, tableTop, TABLE.z - 0.15),
        toWorld(TABLE.x - 0.3, tableTop + 0.05, TABLE.z - 0.12),
        toWorld(TABLE.x - 0.25, tableTop + 0.1, TABLE.z - 0.18),
        toWorld(nsR[0], nsTop + 0.08, nsR[1] + 0.12),
        toWorld(0.3, top, -2.2),
      ].map((p, i) => ({ p, c: book[i % book.length] })),
      bible: toWorld(nsL[0] + 0.05, nsTop, nsL[1] + 0.12),
      cups: [toWorld(TABLE.x + 0.3, tableTop, TABLE.z + 0.2), toWorld(TABLE.x - 0.05, tableTop, TABLE.z + 0.25)],
      fruits: [
        toWorld(TABLE.x + 0.15, tableTop + 0.05, TABLE.z + 0.05),
        toWorld(TABLE.x + 0.08, tableTop + 0.05, TABLE.z),
        toWorld(TABLE.x + 0.22, tableTop + 0.05, TABLE.z - 0.04),
      ],
      shoes: [toWorld(-1.0, 0.05, -1.6), toWorld(-1.2, 0.05, -1.5)],
      suitcase: toWorld(WARDROBE.x + 0.02, WARDROBE.h + 0.22, WARDROBE.z),
      remote: toWorld(-0.3, top, -2.5),
      glass: toWorld(nsL[0] - 0.12, nsTop + 0.05, nsL[1]),
    };
  }, []);

  return (
    <>
      {items.pillows.map((p, i) => (
        <Loose key={`p${i}`} position={p} sound="soft" mass={0.4} restitution={0.05} bodies={bodies}>
          <mesh scale={[1, 1, 1]}>
            <boxGeometry args={[0.62, 0.15, 0.4]} />
            <meshStandardMaterial color="#f1ebdd" roughness={0.95} />
          </mesh>
        </Loose>
      ))}
      {items.books.map(({ p, c }, i) => (
        <Loose key={`b${i}`} position={p} rotation={[0, i * 0.7, 0]} sound="thud" mass={0.6} bodies={bodies}>
          <mesh>
            <boxGeometry args={[0.16, 0.04, 0.23]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
        </Loose>
      ))}
      {/* The hotel rulebook — readable */}
      <Loose position={items.bible} sound="thud" mass={0.7} bodies={bodies}>
        <Interactable
          label="Lire le règlement intérieur"
          onInteract={() =>
            ui().showNote({
              title: 'Règlement intérieur — article 13',
              body:
                'Tout objet tombé appartient au plafond.\n\n' +
                'Le personnel décline toute responsabilité en cas de chute vers le haut.\n\n' +
                'Ce qui reste en haut ne se donne qu’à l’endroit. Les reflets, eux, ne sont pas facturés : servez-vous.',
              variant: 'paper',
            })
          }
        >
          <mesh>
            <boxGeometry args={[0.17, 0.05, 0.24]} />
            <meshStandardMaterial color="#1b2a4a" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.026, 0]}>
            <planeGeometry args={[0.1, 0.06]} />
            <meshStandardMaterial color="#c9973f" metalness={0.8} roughness={0.3} />
          </mesh>
        </Interactable>
      </Loose>
      {items.cups.map((p, i) => (
        <Loose key={`c${i}`} position={p} sound="clink" mass={0.25} restitution={0.35} colliders="hull" bodies={bodies}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.035, 0.09, 14]} />
            <meshStandardMaterial color="#efe8da" roughness={0.25} />
          </mesh>
        </Loose>
      ))}
      <Loose position={items.glass} sound="clink" mass={0.2} restitution={0.3} colliders="hull" bodies={bodies}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.03, 0.11, 12]} />
          <meshStandardMaterial color="#cfe6ff" roughness={0.05} transparent opacity={0.45} />
        </mesh>
      </Loose>
      {items.fruits.map((p, i) => (
        <Loose key={`f${i}`} position={p} sound="soft" mass={0.18} restitution={0.4} colliders="ball" bodies={bodies}>
          <mesh>
            <sphereGeometry args={[0.04, 14, 10]} />
            <meshStandardMaterial color={['#a3251c', '#c9a227', '#7a9a2a'][i]} roughness={0.5} />
          </mesh>
        </Loose>
      ))}
      {items.shoes.map((p, i) => (
        <Loose key={`s${i}`} position={p} rotation={[0, 0.3 + i * 0.4, 0]} sound="thud" mass={0.4} bodies={bodies}>
          <mesh>
            <boxGeometry args={[0.1, 0.08, 0.27]} />
            <meshStandardMaterial color="#160d08" roughness={0.35} />
          </mesh>
        </Loose>
      ))}
      <Loose position={items.remote} rotation={[0, 0.5, 0]} sound="clink" mass={0.15} bodies={bodies}>
        <mesh>
          <boxGeometry args={[0.05, 0.02, 0.18]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
      </Loose>
      {/* Suitcase (fell off the top of the wardrobe) */}
      <Loose position={items.suitcase} sound="thud" mass={4} restitution={0.05} bodies={bodies}>
        <Interactable
          label="Lire l’étiquette"
          onInteract={() => ui().showToast('Étiquette : « FRAGILE — CE CÔTÉ VERS LE HAUT ↓ »')}
        >
          <mesh>
            <boxGeometry args={[0.55, 0.2, 0.4]} />
            <meshStandardMaterial color="#6a3a22" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <boxGeometry args={[0.18, 0.025, 0.03]} />
            <meshStandardMaterial color="#1a1008" />
          </mesh>
          <mesh position={[0.2, 0.101, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.1, 0.06]} />
            <meshStandardMaterial color="#e6d2a0" />
          </mesh>
          <Text font={FONT_MONO} fontSize={0.012} position={[0.2, 0.103, 0.1]} rotation={[-Math.PI / 2, 0, Math.PI]} color="#6b1e2c" anchorX="center" anchorY="middle">
            {'FRAGILE\nHAUT ↓'}
          </Text>
        </Interactable>
      </Loose>
    </>
  );
}

/** The freed key: falls "up" (toward the player), lands on the mirror, can be taken. */
function FallingKey({ onTake, onLanded }: { onTake: () => void; onLanded: () => void }) {
  const landed = useRef(false);
  return (
    <RigidBody
      position={[KEY_WORLD[0], KEY_WORLD[1] - 0.08, KEY_WORLD[2]]}
      rotation={[Math.PI, 0.6, 0]}
      angularVelocity={[2.5, 0.8, -1.2]}
      colliders={false}
      mass={0.2}
      restitution={0.35}
      ccd
      collisionGroups={G_KEY}
      onCollisionEnter={(e) => {
        const p = e.target.rigidBody?.translation();
        if (p) sfx.ding([p.x, p.y, p.z], landed.current ? 0.06 : 0.18);
        if (!landed.current) {
          landed.current = true;
          onLanded();
        }
      }}
    >
      <CuboidCollider args={[0.07, 0.015, 0.16]} collisionGroups={G_KEY} />
      <Interactable label="Prendre la clé n°3" distance={2.8} onInteract={onTake}>
        <KeyModel glow={1.6} />
        <mesh>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <pointLight position={[0, 0.15, 0]} intensity={0.8} distance={1.6} decay={2} color="#ffb35a" />
    </RigidBody>
  );
}
