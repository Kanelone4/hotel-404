import tunnel from 'tunnel-rat';

/**
 * DOM portal from inside the Canvas to the HUD layer.
 *
 *   <RoomUI.In><OxygenGauge/></RoomUI.In>   // inside a room scene
 *
 * Rendered above the canvas, below the transition overlay. Elements are
 * pointer-events:none by default — add `pointer-events-auto` where needed.
 */
export const RoomUI = tunnel();
