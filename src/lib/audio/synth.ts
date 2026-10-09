/**
 * Procedural sound generators. Each factory builds a small WebAudio graph and
 * returns a Voice: an output node to connect somewhere, and a stop() that
 * tears it down. No audio files are shipped — the hotel is synthesized.
 */
export interface Voice {
  output: AudioNode;
  stop: () => void;
}

export type SynthFactory = (ctx: AudioContext) => Voice;

type NoiseColor = 'white' | 'pink' | 'brown';

const noiseCache = new WeakMap<AudioContext, Map<NoiseColor, AudioBuffer>>();

/** 4s looping noise buffer, cached per context and color. */
export function noiseBuffer(ctx: AudioContext, color: NoiseColor = 'white'): AudioBuffer {
  let byColor = noiseCache.get(ctx);
  if (!byColor) noiseCache.set(ctx, (byColor = new Map()));
  const cached = byColor.get(color);
  if (cached) return cached;

  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w * 0.5;
    else if (color === 'pink') {
      // Paul Kellet's refined pink filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  byColor.set(color, buf);
  return buf;
}

function loopNoise(ctx: AudioContext, color: NoiseColor) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.loop = true;
  // Random offset so several noise voices never phase together.
  src.start(0, Math.random() * 3.5);
  return src;
}

/** Filtered noise bed (room tone, rumble, hiss). */
export const noise =
  (opts: { color?: NoiseColor; type?: BiquadFilterType; freq?: number; q?: number; gain?: number } = {}): SynthFactory =>
  (ctx) => {
    const src = loopNoise(ctx, opts.color ?? 'pink');
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.frequency.value = opts.freq ?? 800;
    filter.Q.value = opts.q ?? 0.7;
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 1;
    src.connect(filter).connect(out);
    return { output: out, stop: () => src.stop() };
  };

/** Wind: brown noise through a slowly sweeping bandpass. */
export const wind =
  (opts: { base?: number; depth?: number; speed?: number; gain?: number } = {}): SynthFactory =>
  (ctx) => {
    const src = loopNoise(ctx, 'brown');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = opts.base ?? 400;
    bp.Q.value = 1.2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = opts.speed ?? 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = opts.depth ?? 250;
    lfo.connect(lfoGain).connect(bp.frequency);
    const amp = ctx.createGain();
    amp.gain.value = opts.gain ?? 0.8;
    const ampLfo = ctx.createOscillator();
    ampLfo.frequency.value = (opts.speed ?? 0.07) * 1.7;
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.35;
    ampLfo.connect(ampLfoGain).connect(amp.gain);
    src.connect(bp).connect(amp);
    lfo.start();
    ampLfo.start();
    return {
      output: amp,
      stop: () => {
        src.stop();
        lfo.stop();
        ampLfo.stop();
      },
    };
  };

/** Sustained chord of detuned oscillators with slow tremolo. */
export const drone =
  (opts: { freqs?: number[]; type?: OscillatorType; detune?: number; cutoff?: number; gain?: number; tremolo?: number } = {}): SynthFactory =>
  (ctx) => {
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 0.25;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.cutoff ?? 900;
    lp.connect(out);
    const oscs: OscillatorNode[] = [];
    for (const f of opts.freqs ?? [55, 82.4, 110]) {
      for (const sign of [-1, 1]) {
        const o = ctx.createOscillator();
        o.type = opts.type ?? 'sawtooth';
        o.frequency.value = f;
        o.detune.value = sign * (opts.detune ?? 7);
        const g = ctx.createGain();
        g.gain.value = 0.12;
        o.connect(g).connect(lp);
        o.start();
        oscs.push(o);
      }
    }
    const trem = ctx.createOscillator();
    trem.frequency.value = opts.tremolo ?? 0.13;
    const tremGain = ctx.createGain();
    tremGain.gain.value = (opts.gain ?? 0.25) * 0.3;
    trem.connect(tremGain).connect(out.gain);
    trem.start();
    oscs.push(trem);
    return { output: out, stop: () => oscs.forEach((o) => o.stop()) };
  };

/** Fluorescent tube hum: 50Hz mains buzz with harmonics + crackle. */
export const neonHum =
  (opts: { gain?: number; freq?: number } = {}): SynthFactory =>
  (ctx) => {
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 0.15;
    const base = opts.freq ?? 50;
    const oscs: AudioScheduledSourceNode[] = [];
    [1, 2, 3, 6].forEach((h, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'square';
      o.frequency.value = base * h;
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.08, 0.05, 0.02][i];
      o.connect(g).connect(out);
      o.start();
      oscs.push(o);
    });
    const hiss = loopNoise(ctx, 'white');
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const hg = ctx.createGain();
    hg.gain.value = 0.04;
    hiss.connect(hp).connect(hg).connect(out);
    oscs.push(hiss);
    return { output: out, stop: () => oscs.forEach((o) => o.stop()) };
  };

/**
 * Looping music box. `notes` are semitone offsets from `root` (Hz); null = rest.
 * Slightly out of tune on purpose.
 */
export const musicBox =
  (opts: { notes?: (number | null)[]; root?: number; bpm?: number; gain?: number; detune?: number } = {}): SynthFactory =>
  (ctx) => {
    const notes = opts.notes ?? [0, 4, 7, 12, 7, 4, 0, null, 2, 5, 9, 14, 9, 5, 2, null];
    const root = opts.root ?? 523.25;
    const step = 60 / (opts.bpm ?? 92) / 2;
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 0.3;
    let i = 0;
    let next = ctx.currentTime + 0.1;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      while (next < ctx.currentTime + 0.4) {
        const n = notes[i % notes.length];
        if (n !== null) {
          const freq = root * Math.pow(2, n / 12) * (1 + (Math.random() - 0.5) * (opts.detune ?? 0.006));
          pluck(ctx, out, freq, next);
        }
        next += step * (1 + (Math.random() - 0.5) * 0.04);
        i++;
      }
    };
    const timer = window.setInterval(tick, 100);
    tick();
    return {
      output: out,
      stop: () => {
        stopped = true;
        window.clearInterval(timer);
      },
    };
  };

function pluck(ctx: AudioContext, dest: AudioNode, freq: number, t: number) {
  for (const [mult, amp] of [
    [1, 0.5],
    [2.01, 0.2],
    [4.2, 0.06],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 / mult);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 1.5);
  }
}

/** Random sparse events (drips, creaks, distant knocks) from a one-shot fn. */
export const sporadic =
  (fire: (ctx: AudioContext, dest: AudioNode) => void, opts: { min?: number; max?: number; gain?: number } = {}): SynthFactory =>
  (ctx) => {
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 1;
    let timer = 0;
    const schedule = () => {
      const delay = (opts.min ?? 2) + Math.random() * ((opts.max ?? 6) - (opts.min ?? 2));
      timer = window.setTimeout(() => {
        fire(ctx, out);
        schedule();
      }, delay * 1000);
    };
    schedule();
    return { output: out, stop: () => window.clearTimeout(timer) };
  };

/** Synthetic impulse response for a ConvolverNode. `reverse` = reversed tail (room 013). */
export function impulseResponse(ctx: AudioContext, seconds = 2.5, decay = 2.5, reverse = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const n = reverse ? len - i : i;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
    }
  }
  return buf;
}

/** Wraps a factory with a reverb send. */
export const withReverb =
  (inner: SynthFactory, opts: { seconds?: number; decay?: number; reverse?: boolean; wet?: number } = {}): SynthFactory =>
  (ctx) => {
    const v = inner(ctx);
    const out = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = impulseResponse(ctx, opts.seconds, opts.decay, opts.reverse);
    const wet = ctx.createGain();
    wet.gain.value = opts.wet ?? 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 1 - (opts.wet ?? 0.5) * 0.5;
    v.output.connect(dry).connect(out);
    v.output.connect(conv).connect(wet).connect(out);
    return { output: out, stop: v.stop };
  };

/** Wraps a factory with a lowpass (underwater muffling, through-the-wall). */
export const muffled =
  (inner: SynthFactory, cutoff = 600): SynthFactory =>
  (ctx) => {
    const v = inner(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    v.output.connect(lp);
    return { output: lp, stop: v.stop };
  };
