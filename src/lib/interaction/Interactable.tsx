import { useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { registerInteractable, type InteractableData } from './registry';

export interface InteractableProps {
  /** Text shown next to the crosshair, e.g. "Ouvrir le tiroir". */
  label: string;
  onInteract: () => void;
  /** Max distance from the camera, in meters. Default 2.6. */
  distance?: number;
  disabled?: boolean;
  /** Called when the crosshair starts / stops targeting this object. */
  onHoverChange?: (hovered: boolean) => void;
  children: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

/**
 * Wrap any meshes to make them targetable by the center-screen raycast.
 * The player interacts with click (pointer locked), the E key, or the touch
 * "interact" button.
 */
export function Interactable({
  label,
  onInteract,
  distance = 2.6,
  disabled = false,
  onHoverChange,
  children,
  ...groupProps
}: InteractableProps) {
  const ref = useRef<Group>(null);
  const data = useRef<InteractableData>({ label, onInteract, distance, disabled, onHoverChange });
  data.current.label = label;
  data.current.onInteract = onInteract;
  data.current.distance = distance;
  data.current.disabled = disabled;
  data.current.onHoverChange = onHoverChange;

  useEffect(() => {
    if (!ref.current) return;
    return registerInteractable(ref.current, data.current);
  }, []);

  return (
    <group ref={ref} {...groupProps}>
      {children}
    </group>
  );
}
