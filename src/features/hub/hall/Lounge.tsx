import { RoundedBox } from '@react-three/drei';

/** Two armchairs, a low table and a rug — the "waiting area" nobody waits in. */
export function Lounge() {
  return (
    <group position={[5.5, 0, 1]}>
      <mesh rotation-x={-Math.PI / 2} position={[-0.4, 0.004, 0]} receiveShadow>
        <circleGeometry args={[1.9, 48]} />
        <meshStandardMaterial color="#5a2b1d" roughness={1} />
      </mesh>
      <Armchair position={[0.6, 0, -1.2]} rotation={-Math.PI / 2 - 0.3} />
      <Armchair position={[0.6, 0, 1.2]} rotation={-Math.PI / 2 + 0.3} />
      <group position={[-0.6, 0, 0]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.04, 40]} />
          <meshStandardMaterial color="#1a2a24" roughness={0.1} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.25, 0.4, 16]} />
          <meshStandardMaterial color="#b08a3e" metalness={0.85} roughness={0.35} />
        </mesh>
        {/* Ashtray + magazine */}
        <mesh position={[0.15, 0.46, 0.1]}>
          <cylinderGeometry args={[0.08, 0.06, 0.03, 16]} />
          <meshStandardMaterial color="#6d8a7a" roughness={0.2} />
        </mesh>
        <mesh position={[-0.15, 0.447, -0.1]} rotation-y={0.4}>
          <boxGeometry args={[0.22, 0.01, 0.3]} />
          <meshStandardMaterial color="#c4593a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export function Armchair({
  position,
  rotation = 0,
  color = '#7a4a1e',
}: {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.9, 0.35, 0.85]} radius={0.08} position={[0, 0.35, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.9, 0.75, 0.2]} radius={0.08} position={[0, 0.75, -0.35]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.16, 0.5, 0.8]} radius={0.06} position={[s * 0.45, 0.5, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </RoundedBox>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.38, 0.09, sz * 0.32]}>
            <cylinderGeometry args={[0.025, 0.02, 0.18]} />
            <meshStandardMaterial color="#b08a3e" metalness={0.9} roughness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}
