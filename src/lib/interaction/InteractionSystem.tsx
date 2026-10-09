import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, type Object3D } from 'three';
import { interactables, findInteractableRoot } from './registry';
import { onInteract } from '@/lib/input/input';
import { useUI, ui } from '@/stores/uiStore';
import { sfx } from '@/lib/audio/sfx';

const CENTER = new Vector2(0, 0);

/**
 * Raycasts from the screen center every frame against registered
 * Interactables, updates the HUD label and dispatches interactions.
 */
export function InteractionSystem() {
  const camera = useThree((s) => s.camera);
  const raycaster = useRef(new Raycaster());
  const hovered = useRef<Object3D | null>(null);

  useFrame(() => {
    const { transition, note, paused } = ui();
    let next: Object3D | null = null;

    if (!transition.active && !note && !paused && interactables.size > 0) {
      raycaster.current.setFromCamera(CENTER, camera);
      raycaster.current.far = 8;
      const roots = [...interactables.keys()];
      const hits = raycaster.current.intersectObjects(roots, true);
      for (const hit of hits) {
        const root = findInteractableRoot(hit.object);
        if (!root) continue;
        const data = interactables.get(root)!;
        if (!data.disabled && hit.distance <= data.distance) next = root;
        // The first hit occludes whatever lies behind it.
        break;
      }
    }

    if (next !== hovered.current) {
      if (hovered.current) interactables.get(hovered.current)?.onHoverChange?.(false);
      hovered.current = next;
      if (next) interactables.get(next)?.onHoverChange?.(true);
    }
    const label = next ? interactables.get(next)!.label : null;
    if (useUI.getState().hoverLabel !== label) ui().setHoverLabel(label);
  });

  useEffect(
    () =>
      onInteract(() => {
        const target = hovered.current;
        if (!target) return;
        const data = interactables.get(target);
        if (!data || data.disabled) return;
        sfx.click();
        data.onInteract();
      }),
    [],
  );

  useEffect(
    () => () => {
      ui().setHoverLabel(null);
    },
    [],
  );

  return null;
}
