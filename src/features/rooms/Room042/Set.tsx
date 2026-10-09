import { useMemo, useState, type ReactNode } from 'react';
import { Text } from '@react-three/drei';
import { DoubleSide, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { carpet, canvasTexture, rng, wallpaper, wood } from '@/lib/textures/procedural';
import { FONT_DISPLAY, FONT_MONO } from '@/lib/loaders/fonts';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { BED, POCKET, ROOM } from './layout';
import { causticMaterial, shaftMaterial, surfaceMaterial, swayMaterial } from './materials';
import { Floaty } from './Floaty';

/* ──────────────────────────────────────────────────────────────────────────
 * Materials (built once per mount).
 * ────────────────────────────────────────────────────────────────────────── */
function useMaterials() {
  return useMemo(() => {
    const wallTex = wallpaper([5, 2], '#21403f', '#2d5754', 42);
    const wallTexShort = wallpaper([4, 2], '#21403f', '#2d5754', 42);
    const woodTex = wood([1, 1], '#4a3524', 9);
    const darkWood = wood([1, 1], '#2d2018', 13);
    return {
      floor: causticMaterial({ map: carpet([4, 5], ['#14282a', '#24484a', '#7a6a3a', '#3d5e57']), roughness: 1 }, 0.42, 1.2),
      wall: causticMaterial({ map: wallTex, roughness: 0.95 }, 0.5, 0.6),
      wallShort: causticMaterial({ map: wallTexShort, roughness: 0.95 }, 0.5, 0.6),
      ceiling: causticMaterial({ color: '#4e6f70', roughness: 1 }, 0.5, 0.5),
      plaster: causticMaterial({ color: '#7d8c80', roughness: 1 }, 0.5, 0.6),
      wood: causticMaterial({ map: woodTex, roughness: 0.75 }, 0.6, 0.9),
      darkWood: causticMaterial({ map: darkWood, roughness: 0.7 }, 0.6, 0.8),
      linen: causticMaterial({ color: '#b9c9c4', roughness: 0.95 }, 0.6, 0.9),
      brass: new MeshStandardMaterial({ color: '#b8893a', metalness: 0.85, roughness: 0.35 }),
      black: new MeshStandardMaterial({ color: '#0b1112', roughness: 0.6 }),
      duvet: swayMaterial({ color: '#8fa6a8', roughness: 1 }, { height: 1.5, amp: 0.07, curl: 0.12, phase: 0.4, speed: 0.8 }),
      curtainL: swayMaterial({ color: '#6b2f2c', roughness: 1 }, { height: 2.6, amp: 0.16, phase: 0, speed: 0.7 }),
      curtainR: swayMaterial({ color: '#6b2f2c', roughness: 1 }, { height: 2.6, amp: 0.16, phase: 2.1, speed: 0.75 }),
      peel: [0, 1, 2, 3, 4].map((i) =>
        swayMaterial({ map: wallTexShort, roughness: 1, color: '#c8d6cf' }, { height: 1.1, amp: 0.06, curl: 0.22 + i * 0.04, phase: i * 1.7, speed: 0.6 }),
      ),
      glass: new MeshStandardMaterial({ color: '#7ad7e6', emissive: '#2aa4b8', emissiveIntensity: 1.2, roughness: 0.1 }),
      bowl: new MeshStandardMaterial({ color: '#cdeff2', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: DoubleSide, depthWrite: false }),
      shade: new MeshStandardMaterial({ color: '#d8c79a', emissive: '#6a4a1a', emissiveIntensity: 0.25, side: DoubleSide, roughness: 0.9 }),
      paper: new MeshStandardMaterial({ color: '#d9d2bd', side: DoubleSide, roughness: 1 }),
      leather: causticMaterial({ color: '#5a3a26', roughness: 0.6 }, 0.6, 0.8),
      rug: causticMaterial({ color: '#5b2b2a', roughness: 1 }, 0.42, 1.1),
      surface: surfaceMaterial(1),
    };
  }, []);
}

type Mats = ReturnType<typeof useMaterials>;

const seascape = () =>
  canvasTexture('r042-seascape', [256, 192], (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d9c9a0');
    g.addColorStop(0.45, '#c9a46a');
    g.addColorStop(0.46, '#2f6f7a');
    g.addColorStop(1, '#0f2f38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    ctx.strokeStyle = 'rgba(230,240,230,0.35)';
    for (let i = 0; i < 40; i++) {
      const y = h * 0.5 + r() * h * 0.5;
      const x = r() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 3, x + 16 + r() * 10, y);
      ctx.stroke();
    }
    // A tiny hotel on the horizon, already half under.
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(w * 0.62, h * 0.36, 26, 22);
    ctx.fillStyle = '#f1c97a';
    ctx.fillRect(w * 0.62 + 6, h * 0.39, 3, 3);
    ctx.fillRect(w * 0.62 + 15, h * 0.39, 3, 3);
  });

/* ──────────────────────────────────────────────────────────────────────────
 * Shell: floor, walls, ceiling with the air-pocket well.
 * ────────────────────────────────────────────────────────────────────────── */
function Shell({ m }: { m: Mats }) {
  const H = ROOM.height;
  const hx0 = POCKET.x - POCKET.half;
  const hx1 = POCKET.x + POCKET.half;
  const hz0 = POCKET.z - POCKET.half;
  const hz1 = POCKET.z + POCKET.half;
  const shaftH = POCKET.top - H;
  const ceil = (x0: number, x1: number, z0: number, z1: number, k: number) => (
    <mesh key={k} position={[(x0 + x1) / 2, H + 0.05, (z0 + z1) / 2]} material={m.ceiling}>
      <boxGeometry args={[x1 - x0, 0.1, z1 - z0]} />
    </mesh>
  );
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={m.floor}>
        <planeGeometry args={[8, 10]} />
      </mesh>
      {/* Rug */}
      <mesh rotation-x={-Math.PI / 2} position={[0.4, 0.006, 0.3]} receiveShadow material={m.rug}>
        <planeGeometry args={[2.6, 1.7]} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, H / 2, ROOM.minZ]} material={m.wallShort} receiveShadow>
        <planeGeometry args={[8, H]} />
      </mesh>
      <mesh position={[0, H / 2, ROOM.maxZ]} rotation-y={Math.PI} material={m.wallShort}>
        <planeGeometry args={[8, H]} />
      </mesh>
      <mesh position={[ROOM.minX, H / 2, 0]} rotation-y={Math.PI / 2} material={m.wall} receiveShadow>
        <planeGeometry args={[10, H]} />
      </mesh>
      <mesh position={[ROOM.maxX, H / 2, 0]} rotation-y={-Math.PI / 2} material={m.wall} receiveShadow>
        <planeGeometry args={[10, H]} />
      </mesh>

      {/* Baseboards + crown */}
      {[
        [0, ROOM.minZ + 0.02, 8, 0.04],
        [0, ROOM.maxZ - 0.02, 8, 0.04],
      ].map(([x, z, w, d], i) => (
        <group key={`bz${i}`}>
          <mesh position={[x, 0.07, z]} material={m.darkWood}>
            <boxGeometry args={[w, 0.14, d]} />
          </mesh>
          <mesh position={[x, H - 0.05, z]} material={m.plaster}>
            <boxGeometry args={[w, 0.1, d * 2]} />
          </mesh>
        </group>
      ))}
      {[ROOM.minX + 0.02, ROOM.maxX - 0.02].map((x, i) => (
        <group key={`bx${i}`}>
          <mesh position={[x, 0.07, 0]} material={m.darkWood}>
            <boxGeometry args={[0.04, 0.14, 10]} />
          </mesh>
          <mesh position={[x, H - 0.05, 0]} material={m.plaster}>
            <boxGeometry args={[0.08, 0.1, 10]} />
          </mesh>
        </group>
      ))}

      {/* Ceiling around the hole */}
      {ceil(ROOM.minX, hx0, ROOM.minZ, ROOM.maxZ, 0)}
      {ceil(hx1, ROOM.maxX, ROOM.minZ, ROOM.maxZ, 1)}
      {ceil(hx0, hx1, ROOM.minZ, hz0, 2)}
      {ceil(hx0, hx1, hz1, ROOM.maxZ, 3)}

      {/* The well: broken plaster walls rising to a pale skylight */}
      <group position={[POCKET.x, H + shaftH / 2, POCKET.z]}>
        <mesh position={[0, 0, -POCKET.half]} material={m.plaster}>
          <planeGeometry args={[POCKET.half * 2, shaftH]} />
        </mesh>
        <mesh position={[0, 0, POCKET.half]} rotation-y={Math.PI} material={m.plaster}>
          <planeGeometry args={[POCKET.half * 2, shaftH]} />
        </mesh>
        <mesh position={[-POCKET.half, 0, 0]} rotation-y={Math.PI / 2} material={m.plaster}>
          <planeGeometry args={[POCKET.half * 2, shaftH]} />
        </mesh>
        <mesh position={[POCKET.half, 0, 0]} rotation-y={-Math.PI / 2} material={m.plaster}>
          <planeGeometry args={[POCKET.half * 2, shaftH]} />
        </mesh>
        {/* Skylight grille */}
        <mesh position={[0, shaftH / 2 - 0.01, 0]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[POCKET.half * 2, POCKET.half * 2]} />
          <meshStandardMaterial color="#dff6ff" emissive="#bfeaff" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        {[-0.35, 0, 0.35].map((o) => (
          <mesh key={o} position={[o, shaftH / 2 - 0.04, 0]} material={m.black}>
            <boxGeometry args={[0.04, 0.04, POCKET.half * 2]} />
          </mesh>
        ))}
      </group>
      {/* Water surface inside the well */}
      <mesh position={[POCKET.x, POCKET.surface, POCKET.z]} rotation-x={-Math.PI / 2} material={m.surface}>
        <planeGeometry args={[POCKET.half * 2, POCKET.half * 2, 1, 1]} />
      </mesh>
      <pointLight position={[POCKET.x, POCKET.top - 0.3, POCKET.z]} color="#cfefff" intensity={5} distance={6} decay={1.4} />
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Light shafts (fake god rays): window + air well + ceiling cracks.
 * ────────────────────────────────────────────────────────────────────────── */
const Y = new Vector3(0, 1, 0);
function Shaft({ from, dir, length, r0, r1, color, opacity }: { from: [number, number, number]; dir: [number, number, number]; length: number; r0: number; r1: number; color: string; opacity: number }) {
  const { position, quaternion, material } = useMemo(() => {
    const d = new Vector3(...dir).normalize();
    const pos = new Vector3(...from).addScaledVector(d, length / 2);
    // Cylinder +Y (narrow top, uv.y = 1) must point back toward the source.
    const q = new Quaternion().setFromUnitVectors(Y, d.clone().negate());
    return { position: pos, quaternion: q, material: shaftMaterial(color, opacity) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <mesh position={position} quaternion={quaternion} material={material} renderOrder={5}>
      <cylinderGeometry args={[r0, r1, length, 24, 1, true]} />
    </mesh>
  );
}

export function Shafts() {
  return (
    <group>
      <Shaft from={[3.95, 1.75, -3.0]} dir={[-1, -0.55, 0.25]} length={5.2} r0={0.45} r1={1.3} color="#7fe3ee" opacity={0.22} />
      <Shaft from={[3.95, 1.95, -2.7]} dir={[-1, -0.7, 0.45]} length={4.6} r0={0.25} r1={0.8} color="#a8f3ff" opacity={0.18} />
      <Shaft from={[3.95, 1.45, -3.3]} dir={[-1, -0.45, -0.05]} length={4.8} r0={0.2} r1={0.65} color="#6fd6e6" opacity={0.15} />
      <Shaft from={[POCKET.x, POCKET.top, POCKET.z]} dir={[0.04, -1, 0.02]} length={4.6} r0={0.55} r1={1.45} color="#d2f4ff" opacity={0.28} />
      <Shaft from={[-2.4, ROOM.height, -1.2]} dir={[0.12, -1, 0.08]} length={3.2} r0={0.05} r1={0.45} color="#9fe8f5" opacity={0.2} />
      <Shaft from={[0.8, ROOM.height, -3.6]} dir={[-0.1, -1, 0.05]} length={3.2} r0={0.04} r1={0.35} color="#9fe8f5" opacity={0.16} />
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bed, nightstands, floating lamp shade, pillows.
 * ────────────────────────────────────────────────────────────────────────── */
function Bed({ m }: { m: Mats }) {
  const legs: [number, number][] = [
    [-0.92, -0.98],
    [0.92, -0.98],
    [-0.92, 0.98],
    [0.92, 0.98],
  ];
  return (
    <>
      {/* Headboard, bolted to the wall. */}
      <mesh position={[BED.x, 0.95, ROOM.minZ + 0.05]} material={m.darkWood} castShadow>
        <boxGeometry args={[2.25, 1.3, 0.08]} />
      </mesh>
      <Floaty position={[BED.x, 0, BED.z]} lift={0.35} amp={0.03} speed={0.5} tilt={[0.015, 0, -0.025]} heavy>
        {legs.map(([x, z], i) => (
          <mesh key={i} position={[x, 0.075, z]} material={m.darkWood}>
            <boxGeometry args={[0.07, 0.15, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, 0.275, 0]} material={m.wood} castShadow>
          <boxGeometry args={[BED.w, 0.25, BED.l]} />
        </mesh>
        <mesh position={[0, 0.51, 0]} material={m.linen} castShadow>
          <boxGeometry args={[BED.w - 0.1, 0.22, BED.l - 0.1]} />
        </mesh>
        {/* Duvet: hinged at the head, its foot edge lifts and ripples. */}
        <mesh position={[0, 0.66, 0.2]} rotation-x={-Math.PI / 2} material={m.duvet} castShadow>
          <planeGeometry args={[BED.w + 0.06, 1.5, 12, 16]} />
        </mesh>
      </Floaty>
      <Floaty position={[BED.x - 0.48, 0.92, BED.z - 0.75]} lift={0.25} amp={0.06} speed={0.7} tilt={[0.35, 0.2, 0.15]} phase={1}>
        <mesh material={m.linen}>
          <boxGeometry args={[0.7, 0.14, 0.42]} />
        </mesh>
      </Floaty>
      <Floaty position={[BED.x + 0.5, 0.92, BED.z - 0.7]} lift={0.55} amp={0.07} speed={0.6} tilt={[-0.4, -0.5, 0.3]} phase={2.4} spin={0.05}>
        <mesh material={m.linen}>
          <boxGeometry args={[0.7, 0.14, 0.42]} />
        </mesh>
      </Floaty>
    </>
  );
}

function Nightstand({ m, x, children }: { m: Mats; x: number; children?: ReactNode }) {
  return (
    <Floaty position={[x, 0, ROOM.minZ + 0.3]} lift={0.08} amp={0.015} speed={0.5} phase={x} heavy>
      <mesh position={[0, 0.3, 0]} material={m.wood} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.5]} />
      </mesh>
      {children}
    </Floaty>
  );
}

function Drawer({ m, y, open, onOpen, label }: { m: Mats; y: number; open: boolean; onOpen: () => void; label: string }) {
  return (
    <Interactable label={label} distance={2.2} disabled={open} onInteract={onOpen}>
      <group position={[0, y, 0.25 + (open ? 0.22 : 0)]}>
        <mesh material={m.darkWood}>
          <boxGeometry args={[0.52, 0.2, 0.03]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={m.brass}>
          <sphereGeometry args={[0.025, 8, 6]} />
        </mesh>
      </group>
    </Interactable>
  );
}

function BedsideStuff({ m }: { m: Mats }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  return (
    <>
      <Nightstand m={m} x={-2.75}>
        <Drawer
          m={m}
          y={0.42}
          open={leftOpen}
          label="Ouvrir le tiroir"
          onOpen={() => {
            setLeftOpen(true);
            sfx.slide([-2.75, 0.4, -4.5], 0.3);
            sfx.bubbles([-2.75, 0.5, -4.4], 0.3);
            ui().showToast('Une Bible gonflée d’eau. Les pages se sont collées sur « Jonas ».');
          }}
        />
      </Nightstand>
      <Nightstand m={m} x={0.35}>
        <Drawer
          m={m}
          y={0.42}
          open={rightOpen}
          label="Ouvrir le tiroir"
          onOpen={() => {
            setRightOpen(true);
            sfx.slide([0.35, 0.4, -4.5], 0.3);
            ui().showNote({
              title: 'Carte de l’hôtel, plastifiée',
              body: '« Piscine chauffée au 4e étage. Ouverte jour et nuit. »\n\nQuelqu’un a barré « 4e étage » et écrit à la main, en dessous : « partout ».',
              variant: 'paper',
            });
          }}
        />
        {/* Lamp base (the shade drifted away) */}
        <mesh position={[0, 0.66, 0]} material={m.brass}>
          <cylinderGeometry args={[0.09, 0.11, 0.06, 16]} />
        </mesh>
        <mesh position={[0, 0.86, 0]} material={m.brass}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <sphereGeometry args={[0.04, 12, 8]} />
          <meshStandardMaterial color="#fff2cc" emissive="#ffcf7a" emissiveIntensity={0.6} />
        </mesh>
      </Nightstand>
      {/* The shade, drifting above its lamp. */}
      <Floaty position={[0.35, 1.18, ROOM.minZ + 0.35]} lift={0.4} amp={0.08} speed={0.45} tilt={[0.45, 0, 0.25]} spin={0.25} phase={0.7}>
        <mesh material={m.shade} castShadow>
          <cylinderGeometry args={[0.12, 0.2, 0.22, 20, 1, true]} />
        </mesh>
      </Floaty>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Window + curtains, desk, wardrobe, door, frame, floating clutter.
 * ────────────────────────────────────────────────────────────────────────── */
function WindowWall({ m }: { m: Mats }) {
  return (
    <group>
      <Interactable
        label="Regarder par la fenêtre"
        distance={2.8}
        onInteract={() => ui().showToast('Derrière la vitre : de l’eau, encore de l’eau. Tout en bas, minuscule, le hall éclairé.')}
        position={[ROOM.maxX - 0.03, 1.7, -3]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh material={m.glass}>
          <planeGeometry args={[1.3, 1.4]} />
        </mesh>
        {[
          [0, 0.72, 1.42, 0.06],
          [0, -0.72, 1.42, 0.06],
          [0.68, 0, 0.06, 1.5],
          [-0.68, 0, 0.06, 1.5],
          [0, 0, 0.04, 1.4],
          [0, 0.1, 1.3, 0.04],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.02]} material={m.darkWood}>
            <boxGeometry args={[w, h, 0.06]} />
          </mesh>
        ))}
      </Interactable>
      <pointLight position={[3.4, 1.7, -3]} color="#4fc6d8" intensity={3} distance={5} decay={1.5} />
      {/* Curtain rod + curtains */}
      <mesh position={[ROOM.maxX - 0.12, 2.98, -3]} rotation-x={Math.PI / 2} material={m.brass}>
        <cylinderGeometry args={[0.015, 0.015, 2.4, 8]} />
      </mesh>
      <mesh position={[ROOM.maxX - 0.15, 1.66, -3.85]} rotation-y={-Math.PI / 2} material={m.curtainL} castShadow>
        <planeGeometry args={[0.75, 2.6, 10, 26]} />
      </mesh>
      <mesh position={[ROOM.maxX - 0.15, 1.66, -2.15]} rotation-y={-Math.PI / 2} material={m.curtainR} castShadow>
        <planeGeometry args={[0.75, 2.6, 10, 26]} />
      </mesh>
    </group>
  );
}

function Desk({ m }: { m: Mats }) {
  return (
    <group>
      <group position={[3.62, 0, -0.6]}>
        <mesh position={[0, 0.79, 0]} material={m.wood} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.05, 1.95]} />
        </mesh>
        <mesh position={[0, 0.39, 0.62]} material={m.wood} castShadow>
          <boxGeometry args={[0.66, 0.76, 0.6]} />
        </mesh>
        {[
          [-0.3, -0.9],
          [0.3, -0.9],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.38, z]} material={m.darkWood}>
            <boxGeometry args={[0.05, 0.76, 0.05]} />
          </mesh>
        ))}
      </group>
      {/* Telephone — lifted by the water, cord trailing. */}
      <Floaty position={[3.6, 0.86, -1.1]} lift={0.18} amp={0.03} speed={0.8} tilt={[0.1, 0.4, -0.2]}>
        <Interactable
          label="Décrocher"
          distance={2.2}
          onInteract={() => {
            sfx.bubbles([3.6, 1.0, -1.1], 0.5);
            ui().showToast('Des bulles sortent du combiné. Quelqu’un rit, très loin, sous plusieurs étages d’eau.');
          }}
        >
          <mesh material={m.black} castShadow>
            <boxGeometry args={[0.22, 0.08, 0.18]} />
          </mesh>
          <mesh position={[0, 0.07, 0]} rotation-z={0.15} material={m.black}>
            <boxGeometry args={[0.26, 0.04, 0.06]} />
          </mesh>
        </Interactable>
      </Floaty>
      {/* Empty fishbowl. */}
      <Interactable
        label="Examiner le bocal"
        distance={2.2}
        position={[3.62, 0.96, -0.2]}
        onInteract={() => ui().showToast('Le bocal est vide. Son locataire est sorti se promener.')}
      >
        <mesh material={m.bowl}>
          <sphereGeometry args={[0.15, 18, 12, 0, Math.PI * 2, 0.35, Math.PI - 0.35]} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 14]} />
          <meshStandardMaterial color="#d9c38a" roughness={1} />
        </mesh>
      </Interactable>
      {/* Chair, drifting upside-down-ish. */}
      <Floaty position={[2.8, 0.25, -0.5]} lift={0.85} amp={0.05} speed={0.4} tilt={[0.6, 0.7, 0.45]} spin={0.06} heavy>
        <mesh position={[0, 0.45, 0]} material={m.wood} castShadow>
          <boxGeometry args={[0.45, 0.05, 0.45]} />
        </mesh>
        <mesh position={[0, 0.75, -0.2]} material={m.wood} castShadow>
          <boxGeometry args={[0.45, 0.55, 0.04]} />
        </mesh>
        {[
          [-0.2, -0.2],
          [0.2, -0.2],
          [-0.2, 0.2],
          [0.2, 0.2],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.22, z]} material={m.darkWood}>
            <boxGeometry args={[0.04, 0.45, 0.04]} />
          </mesh>
        ))}
      </Floaty>
    </group>
  );
}

function Wardrobe({ m }: { m: Mats }) {
  return (
    <group position={[-3.68, 0, 0.4]}>
      <mesh position={[0, 1.15, 0]} material={m.darkWood} castShadow>
        <boxGeometry args={[0.6, 2.3, 1.9]} />
      </mesh>
      <Interactable
        label="Ouvrir l’armoire"
        distance={2.4}
        onInteract={() => {
          sfx.creak([-3.4, 1.2, 0.4], 0.35);
          ui().showToast('Vos vêtements flottent en rang sur leurs cintres. Comme s’ils attendaient quelqu’un.');
        }}
      >
        {/* One door ajar. */}
        <group position={[0.31, 1.15, -0.93]} rotation-y={-0.5}>
          <mesh position={[0.0, 0, 0.47]} material={m.wood}>
            <boxGeometry args={[0.03, 2.2, 0.93]} />
          </mesh>
        </group>
        <mesh position={[0.31, 1.15, 0.47]} material={m.wood}>
          <boxGeometry args={[0.03, 2.2, 0.93]} />
        </mesh>
        <mesh position={[0.34, 1.15, 0.08]} material={m.brass}>
          <boxGeometry args={[0.02, 0.18, 0.02]} />
        </mesh>
      </Interactable>
    </group>
  );
}

function Door({ m }: { m: Mats }) {
  return (
    <group position={[-1.6, 0, ROOM.maxZ - 0.03]} rotation-y={Math.PI}>
      <Interactable
        label="Ouvrir la porte"
        distance={2.4}
        onInteract={() => {
          sfx.thud([-1.6, 1, ROOM.maxZ], 0.3);
          ui().showToast('La poignée tourne. La porte ne bouge pas : toute la mer pousse de l’autre côté.');
        }}
      >
        <mesh position={[0, 1.05, 0]} material={m.wood}>
          <boxGeometry args={[0.95, 2.1, 0.05]} />
        </mesh>
        <mesh position={[0.36, 1.0, 0.05]} material={m.brass}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
        <Text font={FONT_DISPLAY} fontSize={0.12} position={[0, 1.65, 0.03]} color="#d9a441" anchorX="center" anchorY="middle">
          042
        </Text>
      </Interactable>
      {[
        [-0.5, 1.07, 0.06, 2.2],
        [0.5, 1.07, 0.06, 2.2],
        [0, 2.17, 1.06, 0.06],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]} material={m.darkWood}>
          <boxGeometry args={[w, h, 0.08]} />
        </mesh>
      ))}
    </group>
  );
}

function Frame({ m }: { m: Mats }) {
  const tex = useMemo(seascape, []);
  return (
    <Interactable
      label="Lire la plaque"
      distance={2.6}
      position={[BED.x, 2.15, ROOM.minZ + 0.04]}
      rotation={[0, 0, 0.12]}
      onInteract={() =>
        ui().showNote({
          title: 'Plaque de laiton',
          body: '« CHAMBRE AVEC VUE SUR MER »\n\nLa vue est entrée.',
          variant: 'engraving',
        })
      }
    >
      <mesh material={m.darkWood}>
        <boxGeometry args={[1.0, 0.76, 0.04]} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.88, 0.64]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.45, 0.01]} material={m.brass}>
        <boxGeometry args={[0.3, 0.06, 0.01]} />
      </mesh>
    </Interactable>
  );
}

function Peeling({ m }: { m: Mats }) {
  // [x, z, rotY] hinge points near the top of the walls.
  const strips: [number, number, number][] = [
    [ROOM.minX + 0.03, -2.6, Math.PI / 2],
    [ROOM.minX + 0.03, 2.9, Math.PI / 2],
    [1.6, ROOM.minZ + 0.03, 0],
    [ROOM.maxX - 0.03, 1.6, -Math.PI / 2],
    [0.9, ROOM.maxZ - 0.03, Math.PI],
  ];
  return (
    <group>
      {strips.map(([x, z, ry], i) => (
        <group key={i} position={[x, 2.45 - (i % 2) * 0.35, z]} rotation-y={ry}>
          {/* Bare plaster where the paper came off. */}
          <mesh position={[0, 0, 0.002]} material={m.plaster}>
            <planeGeometry args={[0.5, 1.1]} />
          </mesh>
          <mesh position={[0, 0, 0.012]} material={m.peel[i]} castShadow>
            <planeGeometry args={[0.48, 1.1, 4, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Clutter({ m }: { m: Mats }) {
  const papers = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 9 }, () => ({
      p: [-3 + r() * 6, 0.6 + r() * 2.0, -4 + r() * 8] as [number, number, number],
      t: [r() * 3, r() * 3, r() * 3] as [number, number, number],
      ph: r() * 6,
      s: r() * 0.2 - 0.1,
    }));
  }, []);
  return (
    <group>
      {papers.map((p, i) => (
        <Floaty key={i} position={p.p} lift={0} amp={0.12} speed={0.35 + (i % 3) * 0.1} tilt={p.t} spin={p.s} phase={p.ph}>
          <mesh material={m.paper}>
            <planeGeometry args={[0.21, 0.29]} />
          </mesh>
        </Floaty>
      ))}
      {/* Suitcase, lid ajar. */}
      <Floaty position={[-2.4, 0.2, 2.4]} lift={1.0} amp={0.06} speed={0.35} tilt={[0.25, 0.4, 0.55]} spin={0.07} heavy>
        <Interactable
          label="Fouiller la valise"
          distance={2.4}
          onInteract={() => {
            sfx.bubbles([-2.4, 1.2, 2.4], 0.35);
            ui().showToast('Un maillot de bain, une serviette pliée, un ticket : « Arrivée : demain ».');
          }}
        >
          <mesh material={m.leather} castShadow>
            <boxGeometry args={[0.72, 0.16, 0.5]} />
          </mesh>
          <mesh position={[0, 0.2, -0.24]} rotation-x={-1.1} material={m.leather}>
            <boxGeometry args={[0.72, 0.05, 0.5]} />
          </mesh>
          <mesh position={[0, 0, 0.27]} material={m.brass}>
            <torusGeometry args={[0.06, 0.012, 6, 12, Math.PI]} />
          </mesh>
        </Interactable>
      </Floaty>
      {/* "Do not disturb" hanger, escaped from the door handle. */}
      <Floaty position={[-1.1, 1.7, 4.2]} lift={0} amp={0.08} speed={0.5} tilt={[0.1, 0.5, 0.3]} spin={0.15}>
        <mesh>
          <planeGeometry args={[0.16, 0.36]} />
          <meshStandardMaterial color="#d9a441" side={DoubleSide} roughness={0.7} />
        </mesh>
        <Text font={FONT_MONO} fontSize={0.028} maxWidth={0.14} textAlign="center" position={[0, -0.04, 0.002]} color="#0b0f0e" anchorX="center" anchorY="middle">
          NE PAS{'\n'}DÉRANGER
        </Text>
      </Floaty>
    </group>
  );
}

/** Everything static-ish in the drowned room. */
export function RoomSet() {
  const m = useMaterials();
  return (
    <group>
      <Shell m={m} />
      <Bed m={m} />
      <BedsideStuff m={m} />
      <WindowWall m={m} />
      <Desk m={m} />
      <Wardrobe m={m} />
      <Door m={m} />
      <Frame m={m} />
      <Peeling m={m} />
      <Clutter m={m} />
    </group>
  );
}
