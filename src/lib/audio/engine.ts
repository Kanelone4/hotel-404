import { AudioListener, type Object3D } from 'three';
import { useGame } from '@/stores/gameStore';

/**
 * Single audio graph for the whole experience.
 *
 *   voices ──► [PositionalAudio panner] ──► listener gain (master/mute) ──► speakers
 *   ambient ──────────────────────────────►┘
 *
 * The AudioListener is created lazily and attached to the active camera by
 * <AudioRig/>. The context stays suspended until `unlockAudio()` runs from a
 * user gesture (browser autoplay policy).
 */
let listener: AudioListener | null = null;
let sceneRoot: Object3D | null = null;

export function getListener(): AudioListener {
  if (!listener) {
    listener = new AudioListener();
    listener.setMasterVolume(useGame.getState().muted ? 0 : 1);
    useGame.subscribe((s, prev) => {
      if (s.muted !== prev.muted) setMuted(s.muted);
    });
  }
  return listener;
}

export function getContext(): AudioContext {
  return getListener().context;
}

/** Node every non-spatial sound connects to (goes through master volume). */
export function getMasterInput(): AudioNode {
  return getListener().getInput();
}

export async function unlockAudio() {
  const ctx = getContext();
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {
      /* ignored: will retry on next gesture */
    }
  }
  useGame.getState().enableAudio();
}

export function isAudioRunning() {
  return listener?.context.state === 'running';
}

function setMuted(muted: boolean) {
  const l = getListener();
  const g = l.getInput().gain;
  const t = l.context.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(muted ? 0 : 1, t + 0.25);
}

/** Scene used for spatial one-shots (set by <AudioRig/>). */
export function setAudioScene(root: Object3D | null) {
  sceneRoot = root;
}
export function getAudioScene() {
  return sceneRoot;
}
