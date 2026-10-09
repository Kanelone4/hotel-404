import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { useDomReady } from '@/lib/motion/useDomReady';
import { setTitle } from '@/lib/motion/useTitleEasterEgg';
import { useGame, ALL_FRAGMENTS } from '@/stores/gameStore';
import { ROOMS, isRoomId } from '@/features/rooms/registry';
import type { RoomId } from '@/types/game';
import { ROOM_SCENES } from './rooms';
import { Choices, Prose, SrOnly, btnBase, btnPrimary, btnQuiet, type Choice } from './ui';

type Place = 'hall' | 'ascenseur' | RoomId;

const PLAYABLE: Exclude<RoomId, '404'>[] = ['001', '013', '042', '101', '237'];
const TOTAL = ALL_FRAGMENTS.length;

const DEAD_FLOORS: { label: string; spoken: string; line: string }[] = [
  { label: '000', spoken: 'zéro zéro zéro', line: 'L’étage 000 n’existe pas (pour l’instant).' },
  {
    label: '777',
    spoken: 'sept cent soixante-dix-sept',
    line: 'Le 777 est réservé. Pas pour vous.',
  },
  { label: 'SS', spoken: 'sous-sol', line: 'Le sous-sol est inondé. Revenez plus tard.' },
  { label: '∞', spoken: 'infini', line: 'Le bouton est chaud. Rien ne se passe. Pour l’instant.' },
];

const fragmentsText = (n: number) => `${n} fragment${n > 1 ? 's' : ''} sur ${TOTAL}`;

const placeName = (p: Place) =>
  p === 'hall' ? 'Le hall' : p === 'ascenseur' ? 'L’ascenseur' : `Chambre ${p} — ${ROOMS[p].name}`;

/**
 * Accessible text version: the same story as a keyboard / screen-reader
 * friendly text adventure. Progress is shared with the 3D version.
 */
export default function Lite() {
  useDomReady();
  const [params, setParams] = useSearchParams();
  const fragments = useGame((s) => s.fragments);
  const completed = useGame((s) => s.completedRooms);
  const unlocked = useGame((s) => s.room404Unlocked);
  const visitRoom = useGame((s) => s.visitRoom);
  const completeRoom = useGame((s) => s.completeRoom);
  const setCurrentRoom = useGame((s) => s.setCurrentRoom);
  const systemReduced = useReducedMotion();
  const userReduced = useGame((s) => s.reducedMotion);
  const reduced = Boolean(systemReduced || userReduced);

  // Current place lives in the URL so the browser Back button works.
  const raw = params.get('lieu') ?? 'hall';
  const requested: Place =
    raw === 'ascenseur' || raw === 'hall' || isRoomId(raw) ? (raw as Place) : 'hall';
  const place: Place = requested === '404' && !unlocked ? 'ascenseur' : requested;

  const [message, setMessage] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const announceTimer = useRef<number | undefined>(undefined);

  /** Clear then set so that repeating the same sentence is announced again. */
  const say = useCallback((text: string) => {
    setMessage('');
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setMessage(text), 60);
  }, []);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  const go = useCallback(
    (p: Place) => {
      setParams(p === 'hall' ? {} : { lieu: p });
    },
    [setParams],
  );

  // On place change: title, shared progress, reset journal, move focus to the heading.
  useEffect(() => {
    setTitle(`${placeName(place)} · Version texte — Hôtel 404`);
    if (isRoomId(place)) visitRoom(place);
    else setCurrentRoom(null);
    window.clearTimeout(announceTimer.current);
    setMessage('');
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [place, visitRoom, setCurrentRoom]);

  const solve = (id: Exclude<RoomId, '404'>) => (text: string) => {
    const fragment = ROOMS[id].fragment;
    const had = fragment ? fragments.includes(fragment) : true;
    completeRoom(id, fragment);
    const count = had ? fragments.length : fragments.length + 1;
    const tail = had
      ? 'Vous l’aviez déjà.'
      : `Fragment ${fragment} récupéré. ${fragmentsText(count)}.${count === TOTAL ? ' Quelque part dans l’ascenseur, un bouton s’allume en rouge : 404.' : ''}`;
    say(`${text} ${tail}`);
  };

  const RoomScene =
    place !== 'hall' && place !== 'ascenseur' && place !== '404' ? ROOM_SCENES[place] : null;

  const motionProps = reduced
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35 },
      };

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto bg-ink text-paper"
      style={{ touchAction: 'pan-y' }}
    >
      <a
        href="#scene-title"
        onClick={(e) => {
          e.preventDefault();
          headingRef.current?.focus();
        }}
        className="sr-only z-50 bg-amber px-4 py-2 font-mono text-sm text-ink focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>

      <header className="border-b border-sage/30">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <p className="font-display text-xl">
            Hôtel <span className="text-amber-soft">404</span>
            <span className="ml-2 font-mono text-xs tracking-[0.2em] text-sage uppercase">
              Version texte
            </span>
          </p>
          <nav aria-label="Liens du site">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs">
              <li>
                <Link
                  to="/"
                  className="text-sage underline decoration-dotted underline-offset-4 hover:text-paper"
                >
                  Version immersive (3D)
                </Link>
              </li>
              <li>
                <Link
                  to="/credits"
                  className="text-sage underline decoration-dotted underline-offset-4 hover:text-paper"
                >
                  Crédits
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-4 sm:px-6">
          <p className="font-mono text-sm text-paper">
            Fragments de clé :{' '}
            <strong className="text-amber-soft">{fragmentsText(fragments.length)}</strong>
            <span aria-hidden className="ml-3 tracking-[0.3em] text-amber-soft">
              {ALL_FRAGMENTS.map((f) => (fragments.includes(f) ? f : '·')).join('')}
            </span>
          </p>
          <nav aria-label="Fil d’Ariane" className="mt-2 font-mono text-xs text-sage">
            <ol className="flex flex-wrap gap-1">
              <li>
                {place === 'hall' ? (
                  <span aria-current="page">Hall</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => go('hall')}
                    className="underline decoration-dotted hover:text-paper"
                  >
                    Hall
                  </button>
                )}
              </li>
              {place !== 'hall' && (
                <li>
                  <span aria-hidden> › </span>
                  {place === 'ascenseur' ? (
                    <span aria-current="page">Ascenseur</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => go('ascenseur')}
                      className="underline decoration-dotted hover:text-paper"
                    >
                      Ascenseur
                    </button>
                  )}
                </li>
              )}
              {isRoomId(place) && (
                <li>
                  <span aria-hidden> › </span>
                  <span aria-current="page">Chambre {place}</span>
                </li>
              )}
            </ol>
          </nav>
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6">
        {/* Keyed so each place mounts fresh (room state resets); fade-in only, so the
            new heading exists right away for the focus effect. */}
        <motion.article key={place} {...motionProps} aria-labelledby="scene-title">
          <h1
            id="scene-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-3xl leading-tight font-light text-paper sm:text-4xl"
          >
            {placeName(place)}
          </h1>
          <div className="mt-6">
            {place === 'hall' && (
              <HallScene go={go} say={say} visited={fragments.length > 0 || completed.length > 0} />
            )}
            {place === 'ascenseur' && (
              <ElevatorScene
                go={go}
                say={say}
                unlocked={unlocked}
                fragments={fragments.length}
                completed={completed}
              />
            )}
            {RoomScene && isRoomId(place) && place !== '404' && (
              <RoomScene say={say} solve={solve(place)} solved={completed.includes(place)} />
            )}
            {place === '404' && <Room404Scene />}
          </div>
        </motion.article>

        {/* Persistent live region: survives scene changes so announcements are never lost. */}
        <section aria-label="Journal" className="mt-8">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`min-h-[1.5rem] text-base leading-relaxed ${message ? 'border-l-2 border-amber-soft bg-night px-4 py-3 text-paper' : ''}`}
          >
            {message}
          </p>
        </section>

        {isRoomId(place) && place !== '404' && (
          <nav aria-label="Sortie" className="mt-8">
            <button
              type="button"
              onClick={() => go('ascenseur')}
              className={`${btnBase} ${btnQuiet}`}
            >
              Quitter la chambre et reprendre l’ascenseur
            </button>
          </nav>
        )}
      </main>

      <footer className="border-t border-sage/30">
        <p className="mx-auto max-w-2xl px-4 py-6 font-mono text-xs leading-relaxed text-sage sm:px-6">
          Votre progression est partagée avec la version immersive. Réception ouverte 24/7 ·
          Check-out : jamais.
        </p>
      </footer>
    </div>
  );
}

/* ────────────────────────────── Hall ────────────────────────────── */

function HallScene({
  go,
  say,
  visited,
}: {
  go: (p: Place) => void;
  say: (t: string) => void;
  visited: boolean;
}) {
  const items: Choice[] = [
    { id: 'lift', label: 'Prendre l’ascenseur', primary: true, onSelect: () => go('ascenseur') },
    {
      id: 'bell',
      label: 'Sonner à la réception',
      onSelect: () =>
        say(
          'Ding. Le son s’éteint trop lentement. Personne ne vient. Sur le comptoir, le registre est ouvert à votre nom, l’encre encore fraîche.',
        ),
    },
    {
      id: 'clocks',
      label: 'Regarder les horloges',
      onSelect: () =>
        say('Paris, Tokyo, New York, et une quatrième sans ville. Toutes indiquent 4 h 04.'),
    },
  ];
  return (
    <>
      <Prose>
        <p>
          Un hôtel qui n’apparaît sur aucune carte. Un hall de marbre, un lustre qui grésille, un
          tapis rouge qui mène à un ascenseur aux portes de laiton.
        </p>
        <p>
          {visited
            ? 'Le portier vous salue comme un habitué. Il ne cligne jamais des yeux.'
            : 'Le personnel vous attendait. On dit qu’en réunissant cinq fragments de clé dans les chambres, on ouvre une porte qui ne devrait pas exister.'}
        </p>
      </Prose>
      <Choices items={items} />
    </>
  );
}

/* ────────────────────────────── Ascenseur ────────────────────────────── */

function ElevatorScene({
  go,
  say,
  unlocked,
  fragments,
  completed,
}: {
  go: (p: Place) => void;
  say: (t: string) => void;
  unlocked: boolean;
  fragments: number;
  completed: RoomId[];
}) {
  const floorBtn =
    'flex w-full min-h-11 items-baseline gap-3 border px-4 py-3 text-left font-mono text-sm';
  return (
    <>
      <Prose>
        <p>
          Les portes se referment dans un soupir. Une musique d’attente, légèrement désaccordée. Le
          panneau de cuivre compte plus de boutons que l’hôtel n’a d’étages.
        </p>
      </Prose>

      <nav aria-labelledby="floors-title" className="mt-8">
        <h2
          id="floors-title"
          className="mb-3 font-mono text-xs tracking-[0.25em] text-sage uppercase"
        >
          Panneau des étages
        </h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {PLAYABLE.map((id) => {
            const done = completed.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => go(id)}
                  className={`${floorBtn} ${btnPrimary}`}
                >
                  <span className="text-base">{id}</span>
                  <span className="text-paper">{ROOMS[id].name}</span>
                  {done && (
                    <span className="ml-auto text-xs text-sage">
                      <span aria-hidden>✓</span>
                      <SrOnly>, fragment récupéré</SrOnly>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-disabled={!unlocked}
              onClick={() =>
                unlocked
                  ? go('404')
                  : say(
                      `Le bouton 404 ne s’enfonce pas. Une voix grésille : « Il vous manque quelque chose. » ${fragmentsText(fragments)}.`,
                    )
              }
              className={`${floorBtn} ${unlocked ? 'border-neon text-neon hover:bg-neon hover:text-ink' : 'border-sage/50 text-sage'}`}
            >
              <span className="text-base">404</span>
              <span>{unlocked ? ROOMS['404'].name : 'Verrouillé'}</span>
              {!unlocked && (
                <SrOnly>
                  , il faut {TOTAL} fragments, vous en avez {fragments}
                </SrOnly>
              )}
            </button>
          </li>
        </ol>

        <h3 className="mt-6 mb-3 font-mono text-xs tracking-[0.25em] text-sage uppercase">
          Autres boutons
        </h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEAD_FLOORS.map((f) => (
            <li key={f.label}>
              <button
                type="button"
                onClick={() => say(f.line)}
                aria-label={`Étage ${f.spoken}`}
                className={`${floorBtn} justify-center border-sage/50 text-sage hover:border-paper hover:text-paper`}
              >
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <button type="button" onClick={() => go('hall')} className={`${btnBase} ${btnQuiet}`}>
          Redescendre au hall
        </button>
      </div>
    </>
  );
}

/* ────────────────────────────── 404 ────────────────────────────── */

/** [corrupted visual text, clean text for assistive tech] */
const MONOLOGUE: [string, string][] = [
  ['Ah. V̷ous. Enfin.', 'Ah. Vous. Enfin.'],
  [
    'Cette chambre n’ex█ste pas. Vous non plus, d’ailleurs. Pas tout à fait.',
    'Cette chambre n’existe pas. Vous non plus, d’ailleurs. Pas tout à fait.',
  ],
  [
    'Cinq fragments. 1, 3, 2, 0, 4. Vous les avez tous r̸amassés, comme un bon client.',
    'Cinq fragments. 1, 3, 2, 0, 4. Vous les avez tous ramassés, comme un bon client.',
  ],
  [
    'Chaque client trouve la porte. Aucun ne trouve la s█rtie.',
    'Chaque client trouve la porte. Aucun ne trouve la sortie.',
  ],
  [
    'Mais je suis un gérant ra̴isonnable. Je vous laisse partir. Cette fois.',
    'Mais je suis un gérant raisonnable. Je vous laisse partir. Cette fois.',
  ],
];

function Room404Scene() {
  return (
    <>
      <Prose>
        <p>
          Le couloir n’a pas de fin, puis il en a une. Une porte rouge, sans poignée. Le numéro
          clignote : 404. Elle s’ouvre avant que vous la touchiez. Derrière un comptoir qui ne
          devrait pas être là, une silhouette en costume vous attend : le Gérant.
        </p>
      </Prose>
      <figure className="mt-8 border border-neon/60 p-5">
        <figcaption className="mb-4 font-mono text-xs tracking-[0.25em] text-neon uppercase">
          Le Gérant
        </figcaption>
        <blockquote className="space-y-3 font-mono text-sm leading-relaxed text-paper">
          {MONOLOGUE.map(([glitch, clean]) => (
            <p key={clean}>
              <span aria-hidden>{glitch}</span>
              <SrOnly>{clean}</SrOnly>
            </p>
          ))}
        </blockquote>
      </figure>
      <div className="mt-8">
        <Link to="/credits" className={`${btnBase} ${btnPrimary} block text-center`}>
          Rendre la clé et faire le check-out
        </Link>
      </div>
    </>
  );
}
