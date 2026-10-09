import { PositionalAudio, type Vector3Tuple } from 'three';
import { getContext, getListener, getMasterInput, getAudioScene, isAudioRunning } from '@/lib/audio/engine';
import { noiseBuffer, type SynthFactory } from '@/lib/audio/synth';

/**
 * Room-237-specific sounds: breathing inside the walls, paper tearing,
 * and the last exhale heard in the dark.
 */

/** Slow, irregular breathing: filtered pink noise shaped by inhale/exhale envelopes. */
export const breathing =
  (opts: { gain?: number } = {}): SynthFactory =>
  (ctx) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'pink');
    src.loop = true;
    src.start(0, Math.random() * 3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.value = 0;
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 1;
    src.connect(bp).connect(env).connect(out);

    let stopped = false;
    let timer = 0;
    const cycle = () => {
      if (stopped) return;
      const t = ctx.currentTime + 0.05;
      const inhale = 1.3 + Math.random() * 0.6;
      const hold = 0.15 + Math.random() * 0.3;
      const exhale = 1.8 + Math.random() * 0.9;
      const pause = 1 + Math.random() * 3;
      env.gain.cancelScheduledValues(t);
      bp.frequency.cancelScheduledValues(t);
      // Inhale: brighter, rising.
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.linearRampToValueAtTime(1300, t + inhale);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.45, t + inhale * 0.75);
      env.gain.linearRampToValueAtTime(0, t + inhale);
      // Exhale: darker, falling, longer.
      const te = t + inhale + hold;
      bp.frequency.setValueAtTime(620, te);
      bp.frequency.linearRampToValueAtTime(360, te + exhale);
      env.gain.setValueAtTime(0, te);
      env.gain.linearRampToValueAtTime(0.8, te + 0.25);
      env.gain.linearRampToValueAtTime(0, te + exhale);
      timer = window.setTimeout(cycle, (inhale + hold + exhale + pause) * 1000);
    };
    cycle();
    return {
      output: out,
      stop: () => {
        stopped = true;
        window.clearTimeout(timer);
        src.stop();
      },
    };
  };

type Play = (ctx: AudioContext, dest: AudioNode, t: number) => number;

/** Same contract as the shared sfx emitter: optional spatial position. */
function emit(play: Play, at?: Vector3Tuple, volume = 1) {
  if (!isAudioRunning()) return;
  const ctx = getContext();
  const t = ctx.currentTime + 0.01;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  const scene = getAudioScene();
  if (at && scene) {
    const pa = new PositionalAudio(getListener());
    pa.position.set(...at);
    pa.setRefDistance(0.8);
    pa.setRolloffFactor(1.6);
    scene.add(pa);
    pa.updateMatrixWorld();
    gain.connect(pa.getOutput());
    const dur = play(ctx, gain, t);
    window.setTimeout(() => {
      scene.remove(pa);
      gain.disconnect();
    }, (dur + 0.5) * 1000);
  } else {
    gain.connect(getMasterInput());
    const dur = play(ctx, gain, t);
    window.setTimeout(() => gain.disconnect(), (dur + 0.5) * 1000);
  }
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 'white');
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 3);
  src.stop(t + dur + 0.05);
  return { f, g };
}

export const sfx237 = {
  /** Wallpaper ripping off plaster: crackling noise with stick-slip grains. */
  tear: (at?: Vector3Tuple, v = 0.6) =>
    emit((ctx, d, t) => {
      const dur = 0.9;
      const { f, g } = noiseBurst(ctx, d, t, dur, 'bandpass', 1800, 0.8);
      f.frequency.linearRampToValueAtTime(3200, t + dur);
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 26; i++) {
        const tt = t + (i / 26) * dur;
        g.gain.setValueAtTime(0.2 + Math.random() * 0.8, tt);
        g.gain.linearRampToValueAtTime(0.05, tt + 0.02);
      }
      g.gain.linearRampToValueAtTime(0, t + dur);
      return dur;
    }, at, v),

  /** One long exhale very close to the listener — the last sound of the room. */
  exhale: (at?: Vector3Tuple, v = 0.9) =>
    emit((ctx, d, t) => {
      const dur = 2.6;
      const { f, g } = noiseBurst(ctx, d, t, dur, 'bandpass', 900, 1.1);
      f.frequency.setValueAtTime(1100, t);
      f.frequency.exponentialRampToValueAtTime(260, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      // Voiced rasp underneath.
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(92, t);
      o.frequency.linearRampToValueAtTime(70, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.06, t + 0.4);
      og.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(lp).connect(og).connect(d);
      o.start(t);
      o.stop(t + dur + 0.05);
      return dur;
    }, at, v),

  /** Torch switch. */
  torchClick: (v = 0.35) =>
    emit((ctx, d, t) => {
      const { g } = noiseBurst(ctx, d, t, 0.05, 'highpass', 2500);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      return 0.1;
    }, undefined, v),
};
