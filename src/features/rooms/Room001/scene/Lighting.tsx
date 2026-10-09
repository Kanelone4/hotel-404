import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Fog, Object3D, type AmbientLight, type HemisphereLight, type PointLight, type SpotLight } from 'three';
import { useQuality } from '@/lib/fx/quality';
import { LAMP_LIGHT, WINDOW, ROOM } from '../layout';
import { useR1 } from '../useRoom001';

const WARM_BG = new Color('#120b07');
const COLD_BG = new Color('#03050b');
const tmp = new Color();

/**
 * Light rig, driven every frame by the tweened levels:
 *  - bedside lamp: warm point light (the only shadow-casting point light)
 *  - moonlight through the window: cold spot from outside, walls cast its shadow
 *  - weak hemisphere fill (warm while the lamp is on) + faint cold ambient
 * Background & fog colors follow the lamp (amber ↔ night blue) and fade to black on exit.
 */
export function Lighting() {
  const { levels } = useR1();
  const { tier } = useQuality();
  const lamp = useRef<PointLight>(null);
  const moon = useRef<SpotLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const amb = useRef<AmbientLight>(null);
  const bg = useRef<Color>(null);

  const target = useMemo(() => new Object3D(), []);

  useFrame(({ scene }) => {
    const live = 1 - levels.exit;
    const l = levels.lamp * levels.flicker;
    const dark = 1 - levels.lamp;
    if (lamp.current) lamp.current.intensity = 7.5 * l * live;
    if (hemi.current) hemi.current.intensity = (0.05 + 0.25 * l) * live;
    if (amb.current) amb.current.intensity = (0.05 + 0.05 * dark) * live;
    if (moon.current) moon.current.intensity = (16 + 22 * dark) * live;

    tmp.copy(WARM_BG).lerp(COLD_BG, dark).multiplyScalar(live);
    bg.current?.copy(tmp);
    if (scene.fog instanceof Fog) scene.fog.color.copy(tmp);
  });

  return (
    <>
      <color ref={bg} attach="background" args={['#120b07']} />
      <fog attach="fog" args={['#120b07', 5, 16]} />

      <hemisphereLight ref={hemi} args={['#ffd9a8', '#2a1a10', 0.3]} />
      <ambientLight ref={amb} color="#5a6c9c" intensity={0.05} />

      <pointLight
        ref={lamp}
        position={LAMP_LIGHT}
        color="#ffb066"
        intensity={7.5}
        distance={9}
        decay={1.5}
        castShadow={tier === 'high'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.004}
        shadow-normalBias={0.03}
        shadow-camera-near={0.05}
        shadow-camera-far={9}
      />

      {/* Moonlight: from outside, high, falling through the window onto the carpet. */}
      <primitive object={target} position={[WINDOW.x - 0.2, 0, -0.6]} />
      <spotLight
        ref={moon}
        position={[WINDOW.x + 0.5, 3.6, ROOM.z0 - 2.4]}
        target={target}
        color="#8fb0ff"
        intensity={16}
        distance={14}
        decay={1.2}
        angle={0.55}
        penumbra={0.7}
        castShadow
        shadow-mapSize-width={tier === 'high' ? 1024 : 512}
        shadow-mapSize-height={tier === 'high' ? 1024 : 512}
        shadow-bias={-0.0008}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
    </>
  );
}
