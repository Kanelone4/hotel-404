import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Player } from '@/features/hub/Player';
import { useRoom } from '@/features/rooms/useRoom';
import { Ambient, Spatial } from '@/lib/audio/Sound';
import { noise } from '@/lib/audio/synth';
import { useQuality } from '@/lib/fx/quality';
import { BOUNDS, COLLIDERS, DRESSER, SPAWN, SPAWN_YAW } from './layout';
import { Room001Provider, useRoom001, useRoom001Hints } from './useRoom001';
import { minibarHum, distantEvents } from './audio';
import { Lighting } from './scene/Lighting';
import { Shell } from './scene/Shell';
import { Bed } from './scene/Bed';
import { Nightstand } from './scene/Nightstand';
import { Window } from './scene/Window';
import { Furniture } from './scene/Furniture';
import { Dust } from './scene/Dust';

/**
 * Chambre 001 — « La chambre normale ».
 * The emotional baseline: a warm, still 70s hotel room. Nothing is wrong. Almost.
 *
 * Puzzle: open the nightstand drawer → read the note → switch the lamp off →
 * in the dark a phosphorescent "001 ↓" appears above the bed and a glow leaks
 * from under the pillow → lift it → take the brass key-fragment "1".
 */
export default function Room001() {
  const { complete, exiting } = useRoom('001');
  const r1 = useRoom001({ complete, exiting });
  const { tier } = useQuality();
  useRoom001Hints(r1.s);

  return (
    <Room001Provider value={r1}>
      <Lighting />
      <Shell />
      <Bed />
      <Nightstand />
      <Window />
      <Furniture />
      <Dust />

      <Player start={SPAWN} yaw={SPAWN_YAW} mode="walk" speed={2.2} bounds={BOUNDS} colliders={COLLIDERS} />

      {/* Near silence: faint room tone, the minibar hum, and rarely something far away. */}
      <Ambient sound={noise({ color: 'brown', freq: 180, gain: 0.5 })} volume={0.12} />
      <Spatial sound={minibarHum} position={[(DRESSER.x0 + DRESSER.x1) / 2, 0.3, (DRESSER.z0 + DRESSER.z1) / 2]} volume={0.5} refDistance={0.8} rolloff={1.8} />
      <Ambient sound={distantEvents} volume={0.35} />

      <EffectComposer multisampling={tier === 'high' ? 4 : 0}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
        <Noise opacity={0.05} premultiply blendFunction={BlendFunction.SCREEN} />
        <Vignette offset={0.28} darkness={0.72} />
      </EffectComposer>
    </Room001Provider>
  );
}
