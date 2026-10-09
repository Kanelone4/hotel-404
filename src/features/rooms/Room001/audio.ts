import { muffled, neonHum, sporadic, withReverb, type SynthFactory } from '@/lib/audio/synth';

/** Minibar compressor hum under the TV: mains buzz, muffled by the cabinet. */
export const minibarHum: SynthFactory = muffled(neonHum({ gain: 0.18, freq: 50 }), 380);

/**
 * Once in a long while: something far away — two soft knocks on a door down the
 * corridor, or a distant elevator chime. Long reverb tail, very quiet.
 */
export const distantEvents: SynthFactory = withReverb(
  sporadic(
    (ctx, dest) => {
      const t = ctx.currentTime + 0.05;
      if (Math.random() < 0.6) {
        // Knock, knock.
        for (const dt of [0, 0.28]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(120, t + dt);
          o.frequency.exponentialRampToValueAtTime(60, t + dt + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t + dt);
          g.gain.linearRampToValueAtTime(0.5, t + dt + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
          o.connect(g).connect(dest);
          o.start(t + dt);
          o.stop(t + dt + 0.2);
        }
      } else {
        // Far elevator chime, detuned and dull.
        for (const [f, d] of [
          [659.25, 0],
          [523.25, 0.35],
        ] as const) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f * 0.995;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t + d);
          g.gain.linearRampToValueAtTime(0.12, t + d + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.8);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 900;
          o.connect(lp).connect(g).connect(dest);
          o.start(t + d);
          o.stop(t + d + 2);
        }
      }
    },
    { min: 22, max: 50, gain: 0.5 },
  ),
  { seconds: 3, decay: 3, wet: 0.7 },
);
