import { useGame } from '@/stores/gameStore';
import { useUI } from '@/stores/uiStore';
import { player } from '@/features/hub/playerState';
import { input, triggerInteract } from '@/lib/input/input';
import { travel } from '@/lib/motion/travel';

/** Dev-only handle for QA from the console: `__hotel.ui.setState({ pointerLocked: true })`. */
export function installDebug() {
  if (!import.meta.env.DEV) return;
  Object.assign(window, { __hotel: { ui: useUI, game: useGame, player, input, travel, interact: triggerInteract } });
}
