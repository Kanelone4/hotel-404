import type { SynthFactory } from '@/lib/audio/synth';
import { noiseBuffer } from '@/lib/audio/synth';
import { R } from './state';

/**
 * Room 404 score — one voice that degrades with R.corruption:
 *
 *   drone ─┐
 *   music box (wrong) ─┼─► dry ───────────────┐
 *   artifacts ─┘      ├─► crush A (16 lvl) ─┼─► gate (random drop-outs) ─► out
 *                      └─► crush B (4 lvl)  ─┘
 *
 * "Bitcrush" is a staircase WaveShaper curve (amplitude quantization); the
 * sample-rate-reduction feel comes from the random gain gates chopping the
 * signal on a 1/32 grid. No ScriptProcessor. A single 50 ms scheduler tick
 * updates detuning, mixes and schedules notes ahead of time.
 */
function stairCurve(levels: number) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * levels) / levels;
  }
  return c;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Hall-style music box melody (semitones from root), null = rest. */
const MELODY: (number | null)[] = [0, 4, 7, 12, 7, 4, 0, null, 2, 5, 9, 14, 9, 5, 2, null];

export const score404 = (): SynthFactory => (ctx) => {
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const gate = ctx.createGain();
  gate.connect(out);

  const bus = ctx.createGain();
  const dry = ctx.createGain();
  const preA = ctx.createGain();
  const preB = ctx.createGain();
  const shA = ctx.createWaveShaper();
  shA.curve = stairCurve(16);
  const shB = ctx.createWaveShaper();
  shB.curve = stairCurve(3);
  const wetA = ctx.createGain();
  const wetB = ctx.createGain();
  wetA.gain.value = 0;
  wetB.gain.value = 0;
  // Harsh path is high-passed so it reads as digital fizz, not mud.
  const hpB = ctx.createBiquadFilter();
  hpB.type = 'highpass';
  hpB.frequency.value = 400;
  bus.connect(dry).connect(gate);
  bus.connect(preA).connect(shA).connect(wetA).connect(gate);
  bus.connect(preB).connect(shB).connect(hpB).connect(wetB).connect(gate);
  preA.gain.value = 1.6;
  preB.gain.value = 2.5;

  // ── Drone ─────────────────────────────────────────────────────────────
  const droneOut = ctx.createGain();
  droneOut.gain.value = 0.16;
  const droneLp = ctx.createBiquadFilter();
  droneLp.type = 'lowpass';
  droneLp.frequency.value = 500;
  droneLp.connect(droneOut).connect(bus);
  const oscs: OscillatorNode[] = [];
  const drift: number[] = [];
  for (const f of [55, 82.41, 110, 164.81]) {
    for (const sign of [-1, 1]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = sign * 6;
      const g = ctx.createGain();
      g.gain.value = 0.1;
      o.connect(g).connect(droneLp);
      o.start();
      oscs.push(o);
      drift.push(0);
    }
  }

  // ── Music box (plays wrong) ──────────────────────────────────────────
  const boxOut = ctx.createGain();
  boxOut.gain.value = 0.22;
  boxOut.connect(bus);
  const pluck = (freq: number, t: number, attack: number) => {
    for (const [mult, amp] of [
      [1, 0.5],
      [2.01, 0.18],
      [4.2, 0.05],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + 1.3 / mult);
      o.connect(g).connect(boxOut);
      o.start(t);
      o.stop(t + attack + 1.5);
    }
  };

  // ── Digital artifacts ────────────────────────────────────────────────
  const artOut = ctx.createGain();
  artOut.gain.value = 0.12;
  artOut.connect(bus);
  const blip = (t: number) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 600 + Math.random() * 3600;
    const g = ctx.createGain();
    const d = 0.015 + Math.random() * 0.05;
    g.gain.setValueAtTime(0.5, t);
    g.gain.setValueAtTime(0, t + d);
    o.connect(g).connect(artOut);
    o.start(t);
    o.stop(t + d + 0.01);
  };
  const crackle = (t: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500 + Math.random() * 5000;
    f.Q.value = 4;
    const g = ctx.createGain();
    const d = 0.03 + Math.random() * 0.12;
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(artOut);
    s.start(t, Math.random() * 3);
    s.stop(t + d + 0.02);
  };

  // ── Scheduler ────────────────────────────────────────────────────────
  let noteI = 0;
  let nextNote = ctx.currentTime + 1.5;
  let nextGate = ctx.currentTime + 0.1;
  let lastNote = 0;
  let finaleStarted = false;
  let n = 0;
  const tick = () => {
    const now = ctx.currentTime;
    const c = Math.min(1, R.corruption + R.spike * 0.3);
    // Param automation only every 4th tick (200 ms) to keep event lists short.
    const slow = n++ % 4 === 0;

    // Mix: clean → crushed.
    if (slow) {
      dry.gain.setTargetAtTime(1 - c * 0.65, now, 0.2);
      wetA.gain.setTargetAtTime(smooth(0.15, 0.6, c) * 0.55, now, 0.2);
      wetB.gain.setTargetAtTime(smooth(0.55, 1, c) * 0.35 + R.spike * 0.15, now, 0.1);
      droneLp.frequency.setTargetAtTime(500 + c * 1400, now, 0.3);
    }

    // Drone detuning: random walk whose range grows with corruption.
    if (slow && !finaleStarted) {
      oscs.forEach((o, i) => {
        drift[i] = Math.max(-1, Math.min(1, drift[i] + (Math.random() - 0.5) * 0.15));
        const base = (i % 2 ? 1 : -1) * 6;
        o.detune.setTargetAtTime(base + drift[i] * c * c * 90, now, 0.4);
      });
    }
    if (R.finale > 0 && !finaleStarted) {
      // The floor gives way: everything glides an octave and a half down.
      finaleStarted = true;
      oscs.forEach((o) => {
        o.detune.cancelScheduledValues(now);
        o.detune.setValueAtTime(o.detune.value, now);
        o.detune.linearRampToValueAtTime(-1900 + Math.random() * 120, now + 7);
      });
      boxOut.gain.setTargetAtTime(0, now + 4, 1.2);
    }

    // Music box: slows down, drifts out of tune, stutters, skips.
    const step = 60 / (92 - c * 34) / 2;
    while (nextNote < now + 0.3) {
      let note = MELODY[noteI % MELODY.length];
      noteI++;
      if (Math.random() < c * 0.25)
        note = lastNote; // stuck note
      else if (Math.random() < c * 0.15) note = null; // dropped note
      if (note !== null) {
        lastNote = note;
        const cents = (Math.random() - 0.5) * (12 + c * 140);
        const oct = Math.random() < c * 0.12 ? 0.5 : 1;
        const freq = 523.25 * Math.pow(2, (note + cents / 100) / 12) * oct;
        // Sometimes the attack is reversed-ish (slow swell) — the box "rewinds".
        const attack = Math.random() < c * 0.2 ? 0.25 + Math.random() * 0.4 : 0.005;
        pluck(freq, nextNote, attack);
        if (Math.random() < c * 0.3) {
          // Stutter: the same note repeated fast.
          for (let k = 1; k < 3; k++) pluck(freq, nextNote + k * 0.06, 0.003);
        }
      }
      nextNote += step * (1 + (Math.random() - 0.5) * (0.04 + c * 0.5));
    }

    // Gates (drop-outs) + artifacts on a 1/32 grid.
    while (nextGate < now + 0.2) {
      const g = gate.gain;
      if (Math.random() < c * 0.18) {
        g.setValueAtTime(0, nextGate);
        g.setValueAtTime(1, nextGate + 0.02 + Math.random() * 0.1 * c);
      }
      if (Math.random() < c * 0.12) blip(nextGate);
      if (Math.random() < c * 0.06) crackle(nextGate);
      nextGate += 0.0625;
    }
  };
  const timer = window.setInterval(tick, 50);
  tick();

  return {
    output: out,
    stop: () => {
      window.clearInterval(timer);
      oscs.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      });
    },
  };
};
