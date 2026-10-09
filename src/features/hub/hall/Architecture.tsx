import { useMemo } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { carpet, wallpaper, wood, noiseMap } from '@/lib/textures/procedural';
import { FONT_DISPLAY, FONT_MONO } from '@/lib/loaders/fonts';
import { Interactable } from '@/lib/interaction/Interactable';
import { ui } from '@/stores/uiStore';
import { sfx } from '@/lib/audio/sfx';
import { HALL } from './layout';

const { halfW, front, back, height } = HALL;
const depth = front - back;

/** Floor, walls, ceiling, pillars and the entrance — the hall's shell. */
export function Architecture() {
  const tex = useMemo(
    () => ({
      carpet: carpet([7, 10]),
      paper: wallpaper([10, 2]),
      paperSide: wallpaper([14, 2]),
      wood: wood([6, 1], '#4a2e1a'),
      rough: noiseMap([4, 4]),
    }),
    [],
  );

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (front + back) / 2]} receiveShadow>
        <planeGeometry args={[halfW * 2, depth]} />
        <meshStandardMaterial map={tex.carpet} roughness={0.95} />
      </mesh>
      {/* Marble path from the entrance to the elevator */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, (front + back) / 2]} receiveShadow>
        <planeGeometry args={[2.2, depth]} />
        <meshStandardMaterial color="#c9c2b2" roughness={0.25} metalness={0.05} roughnessMap={tex.rough} />
      </mesh>

      {/* Ceiling with coffers */}
      <mesh rotation-x={Math.PI / 2} position={[0, height, (front + back) / 2]}>
        <planeGeometry args={[halfW * 2, depth]} />
        <meshStandardMaterial color="#1c1a16" roughness={1} />
      </mesh>
      {[-4.5, 0, 4.5].map((x) =>
        [-7.5, -2.5, 2.5, 7.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, height - 0.06, z]}>
            <boxGeometry args={[3.6, 0.12, 4.2]} />
            <meshStandardMaterial color="#26221c" roughness={0.9} />
          </mesh>
        )),
      )}

      {/* Side walls: wainscot + wallpaper + brass rail */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * halfW, 0, (front + back) / 2]} rotation-y={(-side * Math.PI) / 2}>
          <mesh position={[0, 0.55, 0]} receiveShadow>
            <planeGeometry args={[depth, 1.1]} />
            <meshStandardMaterial map={tex.wood} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.1 + (height - 1.1) / 2, 0]} receiveShadow>
            <planeGeometry args={[depth, height - 1.1]} />
            <meshStandardMaterial map={tex.paperSide} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.12, 0.02]}>
            <boxGeometry args={[depth, 0.05, 0.04]} />
            <meshStandardMaterial color="#b08a3e" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Back wall (around elevator) */}
      {[-1, 1].map((side) => {
        const w = halfW - HALL.doorHalf;
        return (
          <group key={side} position={[side * (HALL.doorHalf + w / 2), 0, back]}>
            <mesh position={[0, 0.55, 0]}>
              <planeGeometry args={[w, 1.1]} />
              <meshStandardMaterial map={tex.wood} roughness={0.6} />
            </mesh>
            <mesh position={[0, 1.1 + (height - 1.1) / 2, 0]}>
              <planeGeometry args={[w, height - 1.1]} />
              <meshStandardMaterial map={tex.paper} roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, (HALL.cabinHeight + height) / 2, back]}>
        <planeGeometry args={[HALL.doorHalf * 2, height - HALL.cabinHeight]} />
        <meshStandardMaterial map={tex.paper} roughness={0.9} />
      </mesh>

      {/* Front wall + entrance doors */}
      <mesh position={[0, height / 2, front]} rotation-y={Math.PI}>
        <planeGeometry args={[halfW * 2, height]} />
        <meshStandardMaterial map={tex.paper} roughness={0.9} />
      </mesh>
      <Interactable
        label="Sortir"
        distance={3}
        onInteract={() => {
          sfx.thud([0, 1.2, front], 0.4);
          ui().showToast('Les portes ne s’ouvrent pas de l’intérieur.');
        }}
        position={[0, 0, front - 0.02]}
      >
        {[-0.62, 0.62].map((x) => (
          <group key={x} position={[x, 1.3, 0]}>
            <mesh>
              <boxGeometry args={[1.2, 2.6, 0.06]} />
              <meshStandardMaterial color="#b08a3e" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, -0.035]}>
              <planeGeometry args={[1.0, 2.4]} />
              <meshStandardMaterial color="#05080a" roughness={0.05} metalness={0.4} />
            </mesh>
          </group>
        ))}
      </Interactable>
      <Text font={FONT_MONO} position={[0, 2.95, front - 0.03]} rotation-y={Math.PI} fontSize={0.12} letterSpacing={0.3} color="#8fa89a">
        SORTIE · EXIT · AUSGANG
      </Text>

      {/* Pillars */}
      {[-3.8, 3.8].flatMap((x) =>
        [-5, 3].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, height, 24]} />
              <meshStandardMaterial color="#2c3a33" roughness={0.4} metalness={0.1} />
            </mesh>
            {[0.08, height - 0.08].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <cylinderGeometry args={[0.38, 0.38, 0.16, 24]} />
                <meshStandardMaterial color="#b08a3e" metalness={0.85} roughness={0.35} />
              </mesh>
            ))}
          </group>
        )),
      )}

      {/* Signage */}
      <Text font={FONT_DISPLAY} position={[-halfW + 0.03, 3.4, 1.5]} rotation-y={Math.PI / 2} fontSize={0.42} color="#d9a441" letterSpacing={0.08}>
        Réception
      </Text>
      <Text font={FONT_DISPLAY} position={[0, 3.75, back + 0.03]} fontSize={0.2} color="#c9b48a" letterSpacing={0.25}>
        ASCENSEUR
      </Text>

      {/* Back corners: potted palms */}
      {[-6.5, 6.5].map((x) => (
        <Plant key={x} position={[x, 0, -9.2]} />
      ))}
    </group>
  );
}

export function Plant({ position }: { position: [number, number, number] }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        a: (i / 9) * Math.PI * 2,
        tilt: 0.5 + (i % 3) * 0.25,
        len: 0.7 + (i % 4) * 0.12,
      })),
    [],
  );
  return (
    <group position={position}>
      <RoundedBox args={[0.6, 0.65, 0.6]} radius={0.05} position={[0, 0.325, 0]} castShadow>
        <meshStandardMaterial color="#6b3a1e" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.6, 6]} />
        <meshStandardMaterial color="#3a2a14" />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={[0, 1.15, 0]} rotation={[0, l.a, l.tilt]}>
          <coneGeometry args={[0.09, l.len * 2, 4, 1]} />
          <meshStandardMaterial color={i % 2 ? '#2f5a3a' : '#3e6e47'} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}
