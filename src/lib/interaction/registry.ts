import type { Object3D } from 'three';

export interface InteractableData {
  label: string;
  onInteract: () => void;
  distance: number;
  disabled: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

/** Root objects that can be targeted. */
export const interactables = new Map<Object3D, InteractableData>();

export function registerInteractable(obj: Object3D, data: InteractableData) {
  interactables.set(obj, data);
  return () => {
    interactables.delete(obj);
  };
}

/** Walks up the parent chain to find which registered root an object belongs to. */
export function findInteractableRoot(obj: Object3D | null): Object3D | null {
  let o = obj;
  while (o) {
    if (interactables.has(o)) return o;
    o = o.parent;
  }
  return null;
}
