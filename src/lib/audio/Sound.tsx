import { useEffect, useMemo, useRef } from 'react';
import { PositionalAudio as ThreePositionalAudio } from 'three';
import type { Vector3Tuple } from 'three';
import { getContext, getListener, getMasterInput } from './engine';
import type { SynthFactory, Voice } from './synth';

function useVoice(create: SynthFactory, connect: (v: Voice) => AudioNode, volume: number, fade: number) {
  const createRef = useRef(create);
  const volRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const ctx = getContext();
    const voice = createRef.current(ctx);
    const vol = ctx.createGain();
    vol.gain.value = 0;
    volRef.current = vol;
    voice.output.connect(vol).connect(connect(voice));
    vol.gain.setTargetAtTime(volume, ctx.currentTime, fade / 3);
    return () => {
      const t = ctx.currentTime;
      vol.gain.cancelScheduledValues(t);
      vol.gain.setValueAtTime(vol.gain.value, t);
      vol.gain.linearRampToValueAtTime(0, t + fade * 0.6);
      window.setTimeout(() => {
        voice.stop();
        vol.disconnect();
      }, fade * 600 + 50);
    };
    // Mount-once by design: the voice lives for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Volume changes are smoothed, never re-create the voice.
  useEffect(() => {
    const vol = volRef.current;
    if (vol) vol.gain.setTargetAtTime(volume, vol.context.currentTime, 0.15);
  }, [volume]);
}

export interface AmbientProps {
  /** Synth factory — read once on mount. */
  sound: SynthFactory;
  volume?: number;
  /** Fade in/out duration in seconds. */
  fade?: number;
}

/** Non-spatial background layer (room tone, music). Fades in on mount, out on unmount. */
export function Ambient({ sound, volume = 0.5, fade = 2 }: AmbientProps) {
  useVoice(sound, () => getMasterInput(), volume, fade);
  return null;
}

export interface SpatialProps extends AmbientProps {
  position?: Vector3Tuple;
  /** Distance at which volume starts to drop. */
  refDistance?: number;
  rolloff?: number;
  maxDistance?: number;
}

/**
 * 3D-positioned sound (THREE.PositionalAudio). Place it in the scene graph
 * like any object — it follows its parent transform.
 */
export function Spatial({ sound, volume = 0.6, fade = 1.5, position, refDistance = 1, rolloff = 1.5, maxDistance = 40 }: SpatialProps) {
  const pa = useMemo(() => {
    const p = new ThreePositionalAudio(getListener());
    p.setRefDistance(refDistance);
    p.setRolloffFactor(rolloff);
    p.setMaxDistance(maxDistance);
    p.setDistanceModel('inverse');
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useVoice(sound, () => pa.getOutput(), volume, fade);
  useEffect(() => () => pa.gain.disconnect(), [pa]);
  return <primitive object={pa} position={position} />;
}
