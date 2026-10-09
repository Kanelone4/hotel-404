import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  GlitchEffect,
  GlitchMode,
  NoiseEffect,
  PixelationEffect,
  VignetteEffect,
} from 'postprocessing';
import { Vector2 } from 'three';
import { DatamoshEffect } from './DatamoshEffect';
import { R } from './state';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Post-processing stack. All effects are built imperatively and mounted as
 * primitives so their intensities can be driven from R.corruption every frame
 * without re-rendering (the R3F EffectComposer rebuilds its passes whenever
 * its children change, so this component is memoized and never re-renders).
 */
export const Post = memo(function Post({ high, reduced }: { high: boolean; reduced: boolean }) {
  const fx = useMemo(() => {
    const bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: 0.9,
      luminanceThreshold: 0.8,
      luminanceSmoothing: 0.2,
    });
    const mosh = new DatamoshEffect({ resolutionScale: high ? 1 : 0.5 });
    const ca = new ChromaticAberrationEffect({
      offset: new Vector2(0.001, 0.0006),
      radialModulation: false,
      modulationOffset: 0,
    });
    const glitch = new GlitchEffect({
      delay: new Vector2(4, 7),
      duration: new Vector2(0.1, 0.3),
      strength: new Vector2(0.1, 0.3),
      columns: 0.04,
      ratio: 0.9,
    });
    glitch.mode = GlitchMode.DISABLED;
    const pixel = new PixelationEffect(0);
    const noise = new NoiseEffect({ blendFunction: BlendFunction.SCREEN, premultiply: true });
    noise.blendMode.opacity.value = 0.06;
    const vignette = new VignetteEffect({ offset: 0.25, darkness: 0.8 });
    return { bloom, mosh, ca, glitch, pixel, noise, vignette };
  }, [high]);

  useEffect(
    () => () => {
      Object.values(fx).forEach((e) => e.dispose());
    },
    [fx],
  );

  const state = useMemo(() => ({ gran: 0, mode: GlitchMode.DISABLED as GlitchMode }), []);

  useFrame(() => {
    const c = Math.min(1, R.corruption + R.spike * 0.35);
    const t = R.time;
    const { bloom, mosh, ca, glitch, pixel, noise } = fx;

    // Unstable bloom: intensity jitters harder as corruption rises (slow sine with reduced motion).
    const jitter = reduced ? Math.sin(t * 0.8) * 0.5 + 0.5 : Math.random();
    bloom.intensity = 0.8 + c * 1.4 + jitter * c * (reduced ? 0.4 : 1.3) + R.finale * 1.5;

    // Chromatic aberration.
    const caAmt = (0.0008 + c * 0.006 + R.spike * 0.006) * (reduced ? 0.35 : 1);
    const wob = reduced ? 1 : 0.7 + Math.random() * 0.6;
    ca.offset.set(caAmt * wob, caAmt * 0.6 * Math.sin(t * 3.1));

    // Datamosh.
    mosh.amount = smooth(0.22, 1, c) * 0.9 + R.explode * 0.1;
    mosh.rate = reduced ? 1.2 : 5 + c * 10;

    // Pixelation: discrete steps (the effect rounds to even values anyway).
    const gran = Math.round(Math.pow(c, 1.6) * 12 + R.finale * 4) & ~1;
    if (gran !== state.gran) {
      state.gran = gran;
      pixel.granularity = gran;
    }

    // Glitch: sporadic, more frequent and violent with corruption. Off with reduced motion.
    let mode: GlitchMode = GlitchMode.DISABLED;
    if (!reduced && c > 0.15)
      mode = R.explode > 0.4 ? GlitchMode.CONSTANT_WILD : GlitchMode.SPORADIC;
    if (mode !== state.mode) {
      state.mode = mode;
      glitch.mode = mode;
    }
    if (mode === GlitchMode.SPORADIC) {
      glitch.minDelay = 4.5 - c * 4;
      glitch.maxDelay = 8 - c * 6.5;
      glitch.minDuration = 0.08;
      glitch.maxDuration = 0.2 + c * 0.5;
      glitch.minStrength = 0.05 + c * 0.25;
      glitch.maxStrength = 0.15 + c * 0.6;
    }

    noise.blendMode.opacity.value = 0.05 + c * 0.16;
  });

  return (
    <EffectComposer multisampling={high ? 4 : 0}>
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.mosh} dispose={null} />
      <primitive object={fx.ca} dispose={null} />
      <primitive object={fx.glitch} dispose={null} />
      <primitive object={fx.pixel} dispose={null} />
      <primitive object={fx.noise} dispose={null} />
      <primitive object={fx.vignette} dispose={null} />
    </EffectComposer>
  );
});
