import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Fragment, RoomId } from '@/types/game';

export interface RoomDef {
  id: RoomId;
  /** Short name shown in HUD / rewards. */
  name: string;
  fragment: Fragment | null;
  /** Lore line shown on the loading screen while the chunk loads. */
  loadingText: string;
  /** Line shown on the transition back to the hall. */
  exitText: string;
  /** Transition style used when entering. */
  enterStyle: 'elevator' | 'glitch';
  Scene: LazyExoticComponent<ComponentType>;
}

/**
 * Every room is a code-split chunk (React.lazy). Each Room folder exports a
 * default component that renders a complete scene *inside* the shared Canvas:
 * lights, geometry, <Player/>, post-processing, audio and its own DOM UI.
 */
export const ROOMS: Record<RoomId, RoomDef> = {
  '001': {
    id: '001',
    name: 'La chambre normale',
    fragment: '1',
    loadingText: 'Le personnel prépare votre chambre…',
    exitText: 'Tout est normal. Tout est normal.',
    enterStyle: 'elevator',
    Scene: lazy(() => import('./Room001/Room001')),
  },
  '013': {
    id: '013',
    name: "Tout est à l'envers",
    fragment: '3',
    loadingText: 'Merci de tenir la rampe. Le plafond est fraîchement ciré.',
    exitText: 'Le monde se remet à l’endroit…',
    enterStyle: 'elevator',
    Scene: lazy(() => import('./Room013/Room013')),
  },
  '042': {
    id: '042',
    name: "Sous l'eau",
    fragment: '2',
    loadingText: 'Retenez votre respiration. La chambre se remplit.',
    exitText: 'L’eau se retire par les bouches d’aération…',
    enterStyle: 'elevator',
    Scene: lazy(() => import('./Room042/Room042')),
  },
  '101': {
    id: '101',
    name: "Chambre d'enfant",
    fragment: '0',
    loadingText: 'Chut. Quelqu’un dort encore.',
    exitText: 'La boîte à musique s’arrête net.',
    enterStyle: 'elevator',
    Scene: lazy(() => import('./Room101/Room101')),
  },
  '237': {
    id: '237',
    name: 'Abandonnée',
    fragment: '4',
    loadingText: 'Cette chambre n’a pas été nettoyée depuis 1979.',
    exitText: 'Vous ne vous retournez pas.',
    enterStyle: 'elevator',
    Scene: lazy(() => import('./Room237/Room237')),
  },
  '404': {
    id: '404',
    name: 'Celle qui ne devrait pas exister',
    fragment: null,
    loadingText: 'Erreur 404 : chambre introuvable. Chargement quand même…',
    exitText: '',
    enterStyle: 'glitch',
    Scene: lazy(() => import('./Room404/Room404')),
  },
};

export const ROOM_ORDER: RoomId[] = ['001', '013', '042', '101', '237', '404'];

export const isRoomId = (id: string | undefined): id is RoomId =>
  !!id && Object.prototype.hasOwnProperty.call(ROOMS, id);
