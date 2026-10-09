import { Text } from '@react-three/drei';
import { DoubleSide } from 'three';
import { FONT_DISPLAY } from '@/lib/loaders/fonts';

/**
 * Brass room key on a big oval fob engraved "3". Built lying flat in XZ,
 * engraved face toward +Y. ~0.3 m long. Emissive enough to catch the bloom.
 */
export function KeyModel({ glow = 1 }: { glow?: number }) {
  const brass = (
    <meshStandardMaterial color="#c9973f" metalness={0.85} roughness={0.28} emissive="#ff9d2e" emissiveIntensity={0.55 * glow} />
  );
  return (
    <group>
      {/* Fob */}
      <mesh position={[0, 0.012, 0.07]} scale={[1, 1, 1.45]}>
        <cylinderGeometry args={[0.065, 0.065, 0.022, 28]} />
        {brass}
      </mesh>
      <Text
        font={FONT_DISPLAY}
        fontSize={0.1}
        position={[0, 0.0245, 0.075]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="center"
        anchorY="middle"
        color="#2a1606"
      >
        3
        <meshBasicMaterial color="#3a1c06" side={DoubleSide} toneMapped={false} />
      </Text>
      {/* Ring */}
      <mesh position={[0, 0.006, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.005, 8, 24]} />
        {brass}
      </mesh>
      {/* Key bow, shaft and bit */}
      <mesh position={[0, 0.006, -0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.022, 0.007, 8, 20]} />
        {brass}
      </mesh>
      <mesh position={[0, 0.006, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.11, 10]} />
        {brass}
      </mesh>
      <mesh position={[0.016, 0.006, -0.19]}>
        <boxGeometry args={[0.026, 0.01, 0.03]} />
        {brass}
      </mesh>
    </group>
  );
}
