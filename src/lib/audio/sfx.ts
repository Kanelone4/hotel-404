import { PositionalAudio, type Vector3Tuple } from 'three';
import { getContext, getListener, getMasterInput, getAudioScene, isAudioRunning } from './engine';
import { noiseBuffer } from './synth';

/**
 * One-shot sound effects, synthesized on the fly.
 * Every function takes an optional world position: when given (and a scene
 * is registered), the sound is spatialized with a temporary PositionalAudio.
 */
type Play = (ctx: AudioContext, dest: AudioNode, t: number) => number; // returns duration (s)

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
    pa.setRefDistance(1.2);
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

function tone(ctx: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, amp: number, type: OscillatorType = 'sine', attack = 0.004) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function burst(ctx: AudioContext, dest: AudioNode, t: number, dur: number, amp: number, filter: BiquadFilterType, freq: number, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 'white');
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 3);
  src.stop(t + dur + 0.05);
  return f;
}

export const sfx = {
  /** Elevator bell: two bright partials, slightly inharmonic. */
  ding: (at?: Vector3Tuple, v = 0.6) =>
    emit((ctx, d, t) => {
      for (const [f, a] of [[1318.5, 0.35], [2637, 0.12], [3950, 0.05]] as const) tone(ctx, d, t, f, 2.2, a);
      for (const [f, a] of [[1046.5, 0.3], [2093, 0.1]] as const) tone(ctx, d, t + 0.32, f, 2.6, a);
      return 3;
    }, at, v),

  /** UI / button click. */
  click: (at?: Vector3Tuple, v = 0.35) =>
    emit((ctx, d, t) => {
      burst(ctx, d, t, 0.04, 0.6, 'bandpass', 2500, 2);
      tone(ctx, d, t, 180, 0.06, 0.3, 'square');
      return 0.1;
    }, at, v),

  /** Dead button / denied. */
  buzz: (at?: Vector3Tuple, v = 0.3) =>
    emit((ctx, d, t) => {
      tone(ctx, d, t, 110, 0.35, 0.25, 'sawtooth');
      tone(ctx, d, t, 116, 0.35, 0.2, 'sawtooth');
      return 0.4;
    }, at, v),

  /** Heavy impact (objects falling, doors). */
  thud: (at?: Vector3Tuple, v = 0.7) =>
    emit((ctx, d, t) => {
      const o = tone(ctx, d, t, 90, 0.5, 0.8, 'sine', 0.002);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
      burst(ctx, d, t, 0.15, 0.4, 'lowpass', 600);
      return 0.6;
    }, at, v),

  /** Wooden creak (floorboards, drawer, door). */
  creak: (at?: Vector3Tuple, v = 0.4) =>
    emit((ctx, d, t) => {
      const dur = 0.5 + Math.random() * 0.6;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70 + Math.random() * 40, t);
      o.frequency.linearRampToValueAtTime(110 + Math.random() * 80, t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur);
      // Stick-slip: amplitude modulated at irregular rate.
      const am = ctx.createOscillator();
      am.frequency.value = 18 + Math.random() * 14;
      const amg = ctx.createGain();
      amg.gain.value = 0.4;
      am.connect(amg).connect(g.gain);
      o.connect(bp).connect(g).connect(d);
      o.start(t);
      am.start(t);
      o.stop(t + dur);
      am.stop(t + dur);
      return dur;
    }, at, v),

  /** Drawer / sliding wood. */
  slide: (at?: Vector3Tuple, v = 0.4) =>
    emit((ctx, d, t) => {
      const f = burst(ctx, d, t, 0.45, 0.5, 'bandpass', 700, 1.5);
      f.frequency.linearRampToValueAtTime(1200, t + 0.4);
      return 0.5;
    }, at, v),

  /** Water drop. */
  drip: (at?: Vector3Tuple, v = 0.4) =>
    emit((ctx, d, t) => {
      const o = tone(ctx, d, t, 1400, 0.18, 0.4);
      o.frequency.exponentialRampToValueAtTime(600 + Math.random() * 400, t + 0.12);
      return 0.25;
    }, at, v),

  /** Bubbles rising. */
  bubbles: (at?: Vector3Tuple, v = 0.4) =>
    emit((ctx, d, t) => {
      const n = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const tt = t + i * (0.04 + Math.random() * 0.08);
        const o = tone(ctx, d, tt, 300 + Math.random() * 500, 0.08, 0.25);
        o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 900, tt + 0.07);
      }
      return n * 0.12;
    }, at, v),

  /** Reward chime: rising arpeggio. */
  reward: (v = 0.5) =>
    emit((ctx, d, t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(ctx, d, t + i * 0.09, f, 1.6, 0.18, 'triangle'));
      return 2.2;
    }, undefined, v),

  /** Digital glitch burst. */
  glitch: (at?: Vector3Tuple, v = 0.35) =>
    emit((ctx, d, t) => {
      for (let i = 0; i < 6; i++) {
        const tt = t + i * 0.035;
        tone(ctx, d, tt, 80 + Math.random() * 2400, 0.03, 0.3, 'square', 0.001);
      }
      burst(ctx, d, t, 0.25, 0.35, 'highpass', 3000);
      return 0.35;
    }, at, v),

  /** Air rush (transitions). */
  whoosh: (v = 0.4) =>
    emit((ctx, d, t) => {
      const f = burst(ctx, d, t, 1.2, 0.6, 'bandpass', 300, 0.8);
      f.frequency.exponentialRampToValueAtTime(2500, t + 0.9);
      return 1.3;
    }, undefined, v),

  /** Elevator motor run (used during ride transitions). */
  rumble: (v = 0.5, dur = 2.2) =>
    emit((ctx, d, t) => {
      const f = burst(ctx, d, t, dur, 0.9, 'lowpass', 140);
      f.Q.value = 3;
      const o = tone(ctx, d, t, 48, dur, 0.4, 'sawtooth', 0.4);
      o.detune.linearRampToValueAtTime(300, t + dur);
      return dur;
    }, undefined, v),

  /** Single footstep. */
  step: (at?: Vector3Tuple, v = 0.18) =>
    emit((ctx, d, t) => {
      burst(ctx, d, t, 0.09, 0.7, 'lowpass', 500 + Math.random() * 250);
      tone(ctx, d, t, 70 + Math.random() * 20, 0.08, 0.3);
      return 0.12;
    }, at, v),

  /** Low heartbeat (two thumps). */
  heartbeat: (v = 0.5) =>
    emit((ctx, d, t) => {
      for (const off of [0, 0.28]) {
        const o = tone(ctx, d, t + off, 60, 0.22, off ? 0.5 : 0.7, 'sine', 0.01);
        o.frequency.exponentialRampToValueAtTime(35, t + off + 0.2);
      }
      return 0.6;
    }, undefined, v),
};
