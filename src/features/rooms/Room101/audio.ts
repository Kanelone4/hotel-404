import { impulseResponse, type SynthFactory } from '@/lib/audio/synth';

/**
 * A music box whose tempo, pitch and tuning can drift at runtime (the room
 * slowly "unwinds" it) and that can be killed abruptly (exit effect).
 *
 * Melody: « Au clair de la lune », semitone offsets from root.
 */
const MELODY: (number | null)[] = [
  0, 0, 0, 2, 4, null, 2, null, 0, 4, 2, 2, 0, null, null, null,
  0, 0, 0, 2, 4, null, 2, null, 0, 4, 2, 2, 0, null, null, null,
  2, 2, 2, 2, -3, null, -3, null, 2, 0, -1, -3, -5, null, null, null,
];

export interface MusicBoxControl {
  factory: SynthFactory;
  /** 1 = normal tempo; < 1 slows down (spring unwinding). */
  rate: number;
  /** Pitch multiplier (detuned spring). */
  pitch: number;
  /** Random per-note detune amount (fraction). */
  wobble: number;
  /** Cut the sound dead, now. */
  kill: () => void;
}

export function createMusicBox(root = 698.46, bpm = 104): MusicBoxControl {
  const ctl: MusicBoxControl = {
    rate: 1,
    pitch: 1,
    wobble: 0.004,
    kill: () => {},
    factory: (ctx) => {
      const out = ctx.createGain();
      out.gain.value = 0.35;
      // Small-room reverb to push it "distant".
      const conv = ctx.createConvolver();
      conv.buffer = impulseResponse(ctx, 2.2, 3);
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      const dry = ctx.createGain();
      dry.gain.value = 0.8;
      const bus = ctx.createGain();
      bus.connect(dry).connect(out);
      bus.connect(conv).connect(wet).connect(out);

      const baseStep = 60 / bpm / 2;
      let i = 0;
      let next = ctx.currentTime + 0.2;
      let stopped = false;
      const tick = () => {
        if (stopped) return;
        while (next < ctx.currentTime + 0.3) {
          const n = MELODY[i % MELODY.length];
          if (n !== null) {
            const det = 1 + (Math.random() - 0.5) * ctl.wobble;
            pluck(ctx, bus, root * Math.pow(2, n / 12) * ctl.pitch * det, next);
          }
          const rate = Math.max(0.25, ctl.rate);
          next += (baseStep / rate) * (1 + (Math.random() - 0.5) * 0.05 / rate);
          i++;
        }
      };
      const timer = window.setInterval(tick, 80);
      tick();
      ctl.kill = () => {
        stopped = true;
        window.clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 0.03);
      };
      return {
        output: out,
        stop: () => {
          stopped = true;
          window.clearInterval(timer);
        },
      };
    },
  };
  return ctl;
}

/** Tine pluck: fundamental + inharmonic partials, fast decay. */
function pluck(ctx: AudioContext, dest: AudioNode, freq: number, t: number) {
  for (const [mult, amp, dec] of [
    [1, 0.45, 1.6],
    [2.0, 0.16, 0.8],
    [5.4, 0.05, 0.25],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dec + 0.05);
  }
}

/** Night-time room tone: very soft brown noise, low-passed (radiator / house breathing). */
export const roomTone: SynthFactory = (ctx) => {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let k = 0; k < len; k++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[k] = last * 3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(lp).connect(g);
  src.start();
  return { output: g, stop: () => src.stop() };
};
