import { useCallback, useEffect } from 'react';
import { useGame, game } from '@/stores/gameStore';
import { useUI, ui } from '@/stores/uiStore';
import { sfx } from '@/lib/audio/sfx';
import { travel } from '@/lib/motion/travel';
import { ROOMS } from './registry';
import type { RoomId } from '@/types/game';

export interface CompleteOptions {
  /**
   * ms between the reward and the transition back to the hall. During this
   * window `useUI(s => s.exiting)` is true: play the room's exit effect then.
   */
  exitDelay?: number;
}

/**
 * Room lifecycle helpers. Call once at the top of a room scene.
 *
 *   const { complete, leave, completed } = useRoom('013');
 *   ...
 *   complete({ exitDelay: 3500 }); // awards the fragment, plays reward, returns to hall
 */
export function useRoom(id: RoomId) {
  const room = ROOMS[id];
  const completed = useGame((s) => s.completedRooms.includes(id));
  const exiting = useUI((s) => s.exiting);

  useEffect(() => {
    game().visitRoom(id);
    return () => game().setCurrentRoom(null);
  }, [id]);

  const complete = useCallback(
    (opts: CompleteOptions = {}) => {
      if (ui().exiting) return;
      const already = game().completedRooms.includes(id);
      game().completeRoom(id, room.fragment);
      ui().setExiting(true);
      ui().setReward({ room: id, fragment: already ? null : room.fragment, title: room.name });
      sfx.reward();
      void travel('/hall', {
        text: room.exitText,
        spawn: 'elevator',
        delay: opts.exitDelay ?? 4200,
      });
    },
    [id, room],
  );

  /** Leave without completing (menu "retour au hall"). */
  const leave = useCallback(() => {
    void travel('/hall', { text: 'Vous reprenez l’ascenseur.', spawn: 'elevator' });
  }, []);

  return { room, complete, leave, completed, exiting };
}
