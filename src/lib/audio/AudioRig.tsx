import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { getListener, setAudioScene, unlockAudio } from './engine';

/** Attaches the shared AudioListener to the active camera and registers the scene for spatial one-shots. */
export function AudioRig() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const l = getListener();
    camera.add(l);
    return () => {
      camera.remove(l);
    };
  }, [camera]);

  useEffect(() => {
    setAudioScene(scene);
    return () => setAudioScene(null);
  }, [scene]);

  // Any gesture (re)unlocks the context — covers deep links that skip the intro.
  useEffect(() => {
    const unlock = () => void unlockAudio();
    // iOS Safari only resumes an AudioContext from touchend/click, not pointerdown.
    const events = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  return null;
}
