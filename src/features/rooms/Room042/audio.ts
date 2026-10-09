import { getContext, getMasterInput, isAudioRunning } from '@/lib/audio/engine';
import { noiseBuffer, type SynthFactory } from '@/lib/audio/synth';
import { mix } from './state';

/* ──────────────────────────────────────────────────────────────────────────
 * Room 042 voices. All synthesized; nothing ships as a file.
 * ────────────────────────────────────────────────────────────────────────── */

function noiseSrc(ctx: AudioContext, color: 'white' | 'pink' | 'brown', t: number, dur: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.start(t, Math.random() * 3);
  src.stop(t + dur + 0.05);
  return src;
}

function blip(ctx: AudioContext, dest: AudioNode, t: number, f0: number, f1: number, dur: number, amp: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Non-spatial one-shot routed to the master bus (respects global mute). */
function oneShot(play: (ctx: AudioContext, dest: AudioNode, t: number) => number, volume: number) {
  if (!isAudioRunning()) return;
  const ctx = getContext();
  const t = ctx.currentTime + 0.01;
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(getMasterInput());
  const dur = play(ctx, g, t);
  window.setTimeout(() => g.disconnect(), (dur + 0.5) * 1000);
}

/** Regulator-like inhale: band-passed hiss swelling, muffled by the water. */
export function breathIn(volume = 0.25, open = false) {
  oneShot((ctx, d, t) => {
    const dur = open ? 0.55 : 1.1;
    const src = noiseSrc(ctx, 'pink', t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(open ? 1400 : 700, t);
    bp.frequency.linearRampToValueAtTime(open ? 2600 : 1300, t + dur);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(open ? 0.9 : 0.5, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp).connect(g).connect(d);
    return dur;
  }, volume);
}

/** Exhale: low rush + a stream of bubble blips. */
export function breathOut(volume = 0.25) {
  oneShot((ctx, d, t) => {
    const dur = 1.3;
    const src = noiseSrc(ctx, 'brown', t, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(lp).connect(g).connect(d);
    const n = 9 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const tt = t + 0.05 + Math.random() * 1.0;
      const f = 180 + Math.random() * 380;
      blip(ctx, d, tt, f, f * (1.6 + Math.random()), 0.09, 0.12);
    }
    return dur;
  }, volume);
}

/** Draining gurgle: a long downward-sweeping, bubbling rush. */
export function drainGurgle(volume = 0.5) {
  oneShot((ctx, d, t) => {
    const dur = 3.6;
    const src = noiseSrc(ctx, 'brown', t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(90, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp).connect(g).connect(d);
    for (let i = 0; i < 26; i++) {
      const tt = t + Math.random() * dur * 0.9;
      const f = 120 + Math.random() * 300 * (1 - (tt - t) / dur);
      blip(ctx, d, tt, f, f * 2.2, 0.12, 0.1);
    }
    return dur;
  }, volume);
}

/**
 * Water bed: brown-noise pressure + sub swell, through a lowpass whose cutoff
 * follows `mix.cutoff` (opens when the head breaks the surface / water drains).
 */
export const waterBed = (): SynthFactory => (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 'brown');
  src.loop = true;
  src.start(0, Math.random() * 3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = mix.cutoff;
  lp.Q.value = 0.8;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.08;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.25;
  swell.connect(swellGain).connect(out.gain);
  const sub = ctx.createOscillator();
  sub.frequency.value = 41;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.08;
  sub.connect(subGain).connect(out);
  src.connect(lp).connect(out);
  swell.start();
  sub.start();
  const timer = window.setInterval(() => lp.frequency.setTargetAtTime(mix.cutoff, ctx.currentTime, 0.12), 60);
  return {
    output: out,
    stop: () => {
      window.clearInterval(timer);
      src.stop();
      swell.stop();
      sub.stop();
    },
  };
};

/** Distant whale-like moans: slow pitch glides with vibrato, very far away. */
export const whaleSong = (): SynthFactory => (ctx) => {
  const out = ctx.createGain();
  out.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  lp.connect(out);
  let timer = 0;
  let stopped = false;
  const moan = () => {
    if (stopped) return;
    const t = ctx.currentTime + 0.05;
    const dur = 3.5 + Math.random() * 3;
    const base = 90 + Math.random() * 80;
    const peak = base * (1.3 + Math.random() * 0.6);
    for (const [mult, amp, type] of [
      [1, 0.35, 'sine'],
      [2.01, 0.08, 'triangle'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(base * mult, t);
      o.frequency.linearRampToValueAtTime(peak * mult, t + dur * 0.45);
      o.frequency.linearRampToValueAtTime(base * 0.8 * mult, t + dur);
      const vib = ctx.createOscillator();
      vib.frequency.value = 4 + Math.random() * 2;
      const vg = ctx.createGain();
      vg.gain.value = 3 * mult;
      vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(lp);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.1);
      vib.stop(t + dur + 0.1);
    }
    timer = window.setTimeout(moan, (9 + Math.random() * 12) * 1000);
  };
  timer = window.setTimeout(moan, 4000);
  return {
    output: out,
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
};

/**
 * The fish's voice (spatialized by <Spatial/>): bubbly upward blips and a
 * glassy pentatonic chime now and then — easy to follow by ear.
 */
export const fishVoice = (): SynthFactory => (ctx) => {
  const out = ctx.createGain();
  out.gain.value = 1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  lp.connect(out);
  const pent = [0, 3, 5, 7, 10, 12];
  let timer = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const t = ctx.currentTime + 0.02;
    if (Math.random() < 0.22) {
      const root = 523.25;
      for (let i = 0; i < 3; i++) {
        const f = root * Math.pow(2, pent[Math.floor(Math.random() * pent.length)] / 12);
        blip(ctx, lp, t + i * 0.11, f, f * 1.003, 1.2, 0.07, 'triangle');
      }
    } else {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const f = 350 + Math.random() * 500;
        blip(ctx, lp, t + i * 0.07, f, f * 2, 0.08, 0.2);
      }
    }
    timer = window.setTimeout(tick, 350 + Math.random() * 900);
  };
  tick();
  return {
    output: out,
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
};
