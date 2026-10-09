import { sporadic, type SynthFactory } from '@/lib/audio/synth';

/**
 * Wooden creaks (stick-slip friction): a sawtooth through a narrow bandpass,
 * gated by a train of tiny irregular bumps. Fired at random intervals.
 */
export const creaks = (opts: { min?: number; max?: number; gain?: number } = {}): SynthFactory =>
  sporadic(
    (ctx, dest) => {
      const t = ctx.currentTime + 0.02;
      const dur = 0.35 + Math.random() * 0.9;
      const base = 70 + Math.random() * 150;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * (0.65 + Math.random() * 0.7), t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500 + Math.random() * 900;
      bp.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      let ti = t;
      while (ti < t + dur) {
        const step = 0.012 + Math.random() * 0.05;
        const amp = 0.25 + Math.random() * 0.35;
        g.gain.setValueAtTime(0.0001, ti);
        g.gain.linearRampToValueAtTime(amp, ti + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0005, ti + step * 0.9);
        ti += step;
      }
      o.connect(bp).connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.1);
    },
    { min: opts.min ?? 3, max: opts.max ?? 9, gain: opts.gain ?? 0.7 },
  );

/**
 * Low "breathing" of the building: brown noise whose lowpass slowly opens and
 * closes, synced with the wallpaper shader's rhythm (~0.14 Hz).
 */
export const breath =
  (gain = 0.5): SynthFactory =>
  (ctx) => {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.143; // 0.9 rad/s, same as the walls
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(lp.frequency);
    const out = ctx.createGain();
    out.gain.value = gain;
    src.connect(lp).connect(out);
    src.start();
    lfo.start();
    return {
      output: out,
      stop: () => {
        src.stop();
        lfo.stop();
      },
    };
  };
