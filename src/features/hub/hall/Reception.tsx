import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import type { Group } from 'three';
import { wood } from '@/lib/textures/procedural';
import { FONT_MONO } from '@/lib/loaders/fonts';
import { Interactable } from '@/lib/interaction/Interactable';
import { Spatial } from '@/lib/audio/Sound';
import { neonHum } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { ui } from '@/stores/uiStore';
import { useGame } from '@/stores/gameStore';

const GUESTBOOK = (visited: number) => `M. et Mme Lefèvre — ch. 001 — arrivée 12/03/1979 — départ : —
Inconnu — ch. 237 — arrivée 13/03/1979 — départ : —
Une enfant — ch. 101 — arrivée ?? — départ : —
Vous — ch. 404 — arrivée : aujourd’hui — départ : —
${visited > 2 ? '\n(Votre nom est écrit à l’encre fraîche. Ce n’est pas votre écriture.)' : ''}`;

/** Reception desk, bell, guest book, phone and the key rack (key 404 missing). */
export function Reception() {
  const deskWood = useMemo(() => wood([3, 1], '#3d2414', 8), []);
  const visited = useGame((s) => s.visitedRooms.length);
  const bell = useRef<Group>(null);
  const bellHit = useRef(0);

  useFrame((_, dt) => {
    if (!bell.current) return;
    bellHit.current = Math.max(0, bellHit.current - dt * 4);
    bell.current.position.y = 1.14 - bellHit.current * 0.015;
  });

  return (
    <group>
      {/* Desk */}
      <group position={[-5.2, 0, 1.5]}>
        <RoundedBox args={[1.6, 1.1, 5.6]} radius={0.04} position={[0, 0.55, 0]} castShadow receiveShadow>
          <meshStandardMaterial map={deskWood} roughness={0.55} />
        </RoundedBox>
        <mesh position={[0, 1.11, 0]} castShadow>
          <boxGeometry args={[1.8, 0.04, 5.8]} />
          <meshStandardMaterial color="#1f2a24" roughness={0.15} metalness={0.2} />
        </mesh>
        {/* Brass trim */}
        <mesh position={[0.81, 0.9, 0]}>
          <boxGeometry args={[0.02, 0.05, 5.6]} />
          <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* Desk lamp */}
        <group position={[-0.3, 1.13, -2.2]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.4]} />
            <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <coneGeometry args={[0.16, 0.16, 20, 1, true]} />
            <meshStandardMaterial color="#2f5a3a" side={2} emissive="#ffcf7a" emissiveIntensity={0.3} />
          </mesh>
          <pointLight position={[0, 0.35, 0]} intensity={2.5} distance={3} color="#ffc070" />
        </group>
      </group>

      {/* Bell */}
      <Interactable
        label="Sonner"
        onInteract={() => {
          bellHit.current = 1;
          sfx.ding([-4.7, 1.2, 0.2], 0.45);
          const n = (Number(sessionStorage.getItem('bell') ?? 0) || 0) + 1;
          try {
            sessionStorage.setItem('bell', String(n));
          } catch {
            /* ignored */
          }
          if (n === 3) ui().showToast('Personne ne vient.');
          if (n === 7) ui().showToast('Quelque chose, très loin au-dessus, sonne en retour.');
        }}
        position={[-4.7, 0, 0.2]}
      >
        <group ref={bell} position={[0, 1.14, 0]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.08, 0.015, 20]} />
            <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.065, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#d9b25a" metalness={1} roughness={0.2} />
          </mesh>
        </group>
      </Interactable>

      {/* Guest book */}
      <Interactable
        label="Lire le registre"
        onInteract={() => {
          sfx.slide([-4.9, 1.15, 2], 0.2);
          ui().showNote({ title: 'Registre des clients', body: GUESTBOOK(visited), variant: 'paper' });
        }}
        position={[-4.9, 1.14, 2]}
        rotation={[0, 0.25, 0]}
      >
        <mesh>
          <boxGeometry args={[0.4, 0.04, 0.55]} />
          <meshStandardMaterial color="#5a1f1f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.022, 0]}>
          <boxGeometry args={[0.37, 0.005, 0.52]} />
          <meshStandardMaterial color="#e8dfc8" roughness={0.9} />
        </mesh>
      </Interactable>

      {/* Phone */}
      <Interactable
        label="Décrocher"
        onInteract={() => {
          sfx.click([-5.0, 1.2, 3.6]);
          ui().showNote({
            title: 'Combiné',
            body: '…allô ? …\n…la 237… ne la nettoyez pas…\n…et dites-lui que le doudou est sous le lit…\n\n(tonalité)',
            variant: 'system',
          });
        }}
        position={[-5.0, 1.14, 3.6]}
      >
        <RoundedBox args={[0.22, 0.08, 0.26]} radius={0.02} position={[0, 0.04, 0]}>
          <meshStandardMaterial color="#7a1d1d" roughness={0.35} />
        </RoundedBox>
        <RoundedBox args={[0.06, 0.06, 0.3]} radius={0.025} position={[0, 0.11, 0]}>
          <meshStandardMaterial color="#7a1d1d" roughness={0.35} />
        </RoundedBox>
      </Interactable>

      <KeyRack />

      <Spatial sound={neonHum({ gain: 0.25 })} position={[-6.9, 3.4, 1.5]} volume={0.35} refDistance={1.5} />
    </group>
  );
}

/** Wall of numbered pigeonholes. The 404 hook is empty. */
function KeyRack() {
  const unlocked = useGame((s) => s.room404Unlocked);
  const cells = useMemo(() => {
    const labels = ['001', '013', '042', '101', '108', '119', '201', '214', '237', '301', '333', '404'];
    return labels.map((label, i) => ({ label, x: (i % 4) * 0.42 - 0.63, y: Math.floor(i / 4) * -0.42 }));
  }, []);
  return (
    <Interactable
      label="Examiner les clés"
      distance={3.4}
      onInteract={() =>
        ui().showNote({
          title: 'Casier à clés',
          body: unlocked
            ? 'Le crochet 404 n’est plus vide.\nLa clé est chaude, comme si quelqu’un venait de la tenir.'
            : 'Il manque la clé de la 404.\nUne étiquette à la place :\n« En cinq morceaux. Rangés dans les chambres. »',
          variant: 'paper',
        })
      }
      position={[-6.95, 2.6, 1.5]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh position={[0, -0.42, -0.02]}>
        <boxGeometry args={[1.85, 1.4, 0.04]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.7} />
      </mesh>
      {cells.map((c) => {
        const empty = c.label === '404' && !unlocked;
        return (
          <group key={c.label} position={[c.x, c.y, 0]}>
            <Text font={FONT_MONO} fontSize={0.06} color={c.label === '404' ? '#ff4f5e' : '#c9b48a'} position={[0, 0.12, 0.01]}>
              {c.label}
            </Text>
            <mesh position={[0, 0.03, 0.03]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#c79a45" metalness={1} roughness={0.3} />
            </mesh>
            {!empty && (
              <group position={[0, -0.06, 0.035]}>
                <mesh>
                  <boxGeometry args={[0.025, 0.14, 0.01]} />
                  <meshStandardMaterial color="#d9b25a" metalness={1} roughness={0.25} />
                </mesh>
                <mesh position={[0, -0.13, 0]}>
                  <boxGeometry args={[0.07, 0.12, 0.02]} />
                  <meshStandardMaterial color={c.label === '404' ? '#5c0f16' : '#3a2a5a'} roughness={0.5} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </Interactable>
  );
}
