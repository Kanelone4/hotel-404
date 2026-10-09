import { Component, type ReactNode } from 'react';
import { ui } from '@/stores/uiStore';
import { travel } from '@/lib/motion/travel';

/**
 * Catches a crashing scene inside the Canvas so one broken room never takes
 * down the whole WebGL context. Lifts the curtain with an in-world excuse
 * and sends the player back to the hall.
 */
export class SceneErrorBoundary extends Component<{ sceneKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[Hôtel 404] scene crashed:', error);
    ui().setSceneReady(true);
    ui().showToast('Cette chambre est en travaux. Le personnel vous raccompagne.');
    if (this.props.sceneKey !== 'hall') {
      window.setTimeout(() => void travel('/hall', { text: 'Toutes nos excuses pour la gêne occasionnée.', spawn: 'elevator' }), 1500);
    }
  }

  componentDidUpdate(prev: { sceneKey: string }) {
    if (prev.sceneKey !== this.props.sceneKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
