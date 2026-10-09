import { useEffect } from 'react';

const AWAY = ['Revenez…', 'La chambre vous attend.', 'Ne partez pas sans payer.', '404 · vous êtes encore là ?'];

/** Detail that counts: the tab title talks to you when you leave. */
export function useTitleEasterEgg() {
  useEffect(() => {
    let saved = document.title;
    let i = 0;
    const onVis = () => {
      if (document.hidden) {
        saved = document.title;
        document.title = AWAY[i++ % AWAY.length];
      } else {
        document.title = saved;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
}

export function setTitle(t: string) {
  if (!document.hidden) document.title = t;
}
