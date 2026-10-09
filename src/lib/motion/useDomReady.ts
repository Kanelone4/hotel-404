import { useEffect } from 'react';
import { ui } from '@/stores/uiStore';

/** DOM-only pages (intro, credits, lite) are "ready" as soon as they mount. */
export function useDomReady() {
  useEffect(() => {
    ui().setSceneReady(true);
  }, []);
}
