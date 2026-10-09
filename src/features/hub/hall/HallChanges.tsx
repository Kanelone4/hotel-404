import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Group } from 'three';
import { FONT_MONO } from '@/lib/loaders/fonts';
import { Spatial } from '@/lib/audio/Sound';
import { sporadic, musicBox, muffled } from '@/lib/audio/synth';
import { Interactable } from '@/lib/interaction/Interactable';
import { ui } from '@/stores/uiStore';
import { useGame } from '@/stores/gameStore';
import { Armchair } from './Lounge';
import { HALL } from './layout';

/**
 * The hall remembers. Each completed room leaves a trace here:
 *   001 → a painting (see <Paintings/>)
 *   013 → an armchair glued to the ceiling
 *   042 → a puddle that keeps dripping
 *   101 → a teddy bear waiting on the desk, humming
 *   237 → a lamp that flickers (see <Lamps/>) + scratches near the elevator
 *   all → neon "404" sign above the elevator
 */
export function HallChanges() {
  const done = useGame((s) => s.completedRooms);
  const unlocked = useGame((s) => s.room404Unlocked);
  return (
    <group>
      {done.includes('013') && (
        <group position={[2.6, HALL.height, 6.5]} rotation-z={Math.PI}>
          <Armchair position={[0, 0, 0]} rotation={0.7} color="#4d5f56" />
        </group>
      )}
      {done.includes('042') && <Puddle />}
      {done.includes('101') && <Teddy />}
      {done.includes('237') && (
        <Text font={FONT_MONO} position={[-2.2, 1.3, HALL.back + 0.02]} fontSize={0.09} color="#5b4a3a" maxWidth={1.4} rotation-z={-0.05}>
          ELLE N’EST PAS VIDE{'\n'}ELLE N’EST PAS VIDE{'\n'}ELLE N’EST PAS
        </Text>
      )}
      {unlocked && <NeonSign />}
    </group>
  );
}

function Puddle() {
  const drip = sporadic(
    (ctx, dest) => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(500 + Math.random() * 300, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    },
    { min: 1.2, max: 3.5 },
  );
  return (
    <group position={[1.6, 0.006, -7.8]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.9, 40]} />
        <meshStandardMaterial color="#0a1418" metalness={0.9} roughness={0.04} transparent opacity={0.85} />
      </mesh>
      <Spatial sound={drip} position={[0, 0.2, 0]} volume={0.5} refDistance={0.8} />
    </group>
  );
}

function Teddy() {
  const head = useRef<Group>(null);
  useFrame(({ camera }) => {
    // The teddy always turns its head toward you. Slowly.
    if (!head.current) return;
    const p = head.current.getWorldPosition(head.current.position.clone());
    const target = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    head.current.rotation.y += (target - head.current.rotation.y) * 0.01;
  });
  const fur = '#8a5a35';
  return (
    <Interactable
      label="Le doudou"
      onInteract={() => ui().showToast('Il était sous le lit. Maintenant il vous attend ici.')}
      position={[-4.75, 1.13, 3.0]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color={fur} roughness={1} />
      </mesh>
      <group ref={head} position={[0, 0.25, 0]}>
        <mesh>
          <sphereGeometry args={[0.075, 16, 12]} />
          <meshStandardMaterial color={fur} roughness={1} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.055, 0.06, 0]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color={fur} roughness={1} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`e${s}`} position={[s * 0.025, 0.01, 0.068]}>
            <sphereGeometry args={[0.009, 8, 6]} />
            <meshStandardMaterial color="#000" roughness={0.2} />
          </mesh>
        ))}
      </group>
      <Spatial sound={muffled(musicBox({ root: 659, bpm: 58, gain: 0.15, detune: 0.03 }), 1600)} volume={0.25} refDistance={0.5} rolloff={2.5} />
    </Interactable>
  );
}

function NeonSign() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.visible = !(Math.sin(t * 13) > 0.93 || Math.sin(t * 3.1) > 0.985);
  });
  return (
    <group ref={ref} position={[0, 3.95, HALL.back + 0.08]}>
      <Text font={FONT_MONO} fontSize={0.5} color="#ff4f5e" letterSpacing={0.1} outlineWidth={0.01} outlineColor="#ff8a95">
        404
      </Text>
      <pointLight position={[0, 0, 0.4]} intensity={4} distance={5} color="#ff4f5e" />
    </group>
  );
}
