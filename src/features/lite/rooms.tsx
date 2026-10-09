import { useState, type ComponentType } from 'react';
import type { RoomId } from '@/types/game';
import {
  Choices,
  Inscription,
  Prose,
  SrOnly,
  btnBase,
  btnQuiet,
  type Choice,
  type SceneProps,
} from './ui';

/* ────────────────────────────── 001 ────────────────────────────── */

function Room001({ say, solve, solved }: SceneProps) {
  const [lampOn, setLampOn] = useState(true);
  const [paperRead, setPaperRead] = useState(false);

  const items: Choice[] = [
    {
      id: 'lamp',
      label: lampOn ? 'Éteindre la lampe de chevet' : 'Rallumer la lampe de chevet',
      onSelect: () => {
        const next = !lampOn;
        setLampOn(next);
        say(
          next
            ? 'Clic. La lumière revient, jaune et rassurante. Tout est normal.'
            : 'Clic. Le noir tombe d’un coup. Sous l’oreiller, quelque chose luit faiblement.',
        );
      },
    },
    {
      id: 'drawer',
      label: paperRead ? 'Relire le papier du tiroir' : 'Ouvrir le tiroir de la table de nuit',
      onSelect: () => {
        if (lampOn) setPaperRead(true);
        say(
          lampOn
            ? 'Une bible, un stylo de l’hôtel, et un papier plié en quatre. L’écriture est la vôtre : « Vous n’auriez pas dû monter. »'
            : 'Vous tâtonnez dans le tiroir. Un papier. Impossible de le lire sans lumière.',
        );
      },
    },
    {
      id: 'pillow',
      label: 'Soulever l’oreiller',
      primary: !lampOn,
      onSelect: () => {
        if (lampOn) {
          say(
            'Un oreiller. Des draps propres, tirés au cordeau. Rien. Tout est parfaitement normal.',
          );
          return;
        }
        solve(
          'Dans le noir, un éclat froid : un fragment de clé, gravé du chiffre 1. Il n’était pas là quand la lumière était allumée.',
        );
      },
    },
  ];

  return (
    <>
      <Prose>
        <p>
          Une chambre d’hôtel. Moquette beige, lit fait, lampe de chevet allumée. Un tableau de
          voilier au mur. Rien ne cloche. C’est justement ce qui cloche.
        </p>
        <p>
          {lampOn
            ? 'La lampe bourdonne doucement.'
            : 'Il fait noir. Une lueur pâle filtre sous l’oreiller.'}
        </p>
        {paperRead && lampOn && <Inscription>Vous n’auriez pas dû monter.</Inscription>}
        {solved && <p className="text-sage">Le fragment 1 est déjà dans votre poche.</p>}
      </Prose>
      <Choices items={items} />
    </>
  );
}

/* ────────────────────────────── 013 ────────────────────────────── */

function Room013({ say, solve, solved }: SceneProps) {
  const [paintingSeen, setPaintingSeen] = useState(false);
  const [onFloor, setOnFloor] = useState(false);

  const items: Choice[] = onFloor
    ? [
        {
          id: 'key',
          label: 'Ramasser la clé, vite',
          primary: true,
          onSelect: () => {
            setOnFloor(false);
            solve(
              'Vos doigts se referment sur la clé une seconde avant que la gravité ne reparte vers le plafond. Au porte-clé, un fragment gravé du chiffre 3.',
            );
          },
        },
      ]
    : [
        {
          id: 'jump',
          label: 'Sauter vers la clé',
          onSelect: () =>
            say(
              'Vous sautez. Vous retombez… vers le haut, c’est-à-dire sur le plafond. La clé n’a pas bougé.',
            ),
        },
        {
          id: 'suitcase',
          label: 'Ouvrir la valise',
          onSelect: () =>
            say(
              'Les chemises s’envolent vers la moquette au-dessus de vous et s’y posent, bien pliées. Quelqu’un a de l’humour.',
            ),
        },
        paintingSeen
          ? {
              id: 'flip',
              label: 'Remettre le tableau à l’envers',
              ariaLabel:
                'Retourner le tableau pour qu’il soit à l’envers, comme le reste de la pièce',
              primary: true,
              onSelect: () => {
                setOnFloor(true);
                say(
                  'Vous retournez le cadre. La pièce bascule avec lui : vous tombez sur la moquette, la clé à portée de main. Le cadre grince déjà pour revenir.',
                );
              },
            }
          : {
              id: 'painting',
              label: 'Examiner le tableau',
              onSelect: () => {
                setPaintingSeen(true);
                say(
                  'Le seul objet à l’endroit, pour vous. Un paysage normal, un ciel en haut. Sur le cadre, une étiquette : « Ne pas retourner. »',
                );
              },
            },
      ];

  return (
    <>
      <Prose>
        <p>
          Vous marchez sur le plafond. Le lustre se dresse à vos pieds comme un arbre de cristal.
          Au-dessus de votre tête, le lit, la moquette, et posée dessus, une petite clé dorée.
        </p>
        <p>Ici, ce qu’on lâche tombe vers le haut.</p>
        {onFloor && (
          <p className="text-amber-soft">
            Vous êtes sur la moquette. Le monde est à l’endroit. Pour combien de temps ?
          </p>
        )}
        {solved && <p className="text-sage">Le fragment 3 est déjà dans votre poche.</p>}
      </Prose>
      <Choices items={items} />
    </>
  );
}

/* ────────────────────────────── 042 ────────────────────────────── */

const O2_MAX = 3;
const FISH_STEPS = [
  'Le poisson lumineux file sous le lit englouti. Vous le suivez entre les ressorts.',
  'Il passe la porte de la salle de bain, ondule devant le miroir. Votre reflet ne bouge pas en même temps que vous.',
  'Il plonge dans la baignoire, vers la bonde. Une lueur répond à la sienne.',
];

function Room042({ say, solve, solved }: SceneProps) {
  const [o2, setO2] = useState(O2_MAX);
  const [step, setStep] = useState(0);

  const o2Text = (n: number) => `Oxygène : ${n} sur ${O2_MAX}.`;

  const spend = (text: string, after: () => void) => {
    const left = o2 - 1;
    if (left <= 0) {
      setO2(O2_MAX);
      say(
        `${text} Votre vue se brouille. Vous vous réveillez contre le plafond, dans la poche d’air, en toussant. Le poisson vous attend. ${o2Text(O2_MAX)}`,
      );
      return;
    }
    setO2(left);
    after();
    say(`${text} ${o2Text(left)}`);
  };

  const items: Choice[] = [
    {
      id: 'fish',
      label: step === 0 ? 'Suivre le poisson lumineux' : 'Continuer à suivre le poisson',
      primary: true,
      onSelect: () => {
        if (step >= FISH_STEPS.length) {
          solve(
            'Dans la bonde, coincé dans un anneau de calcaire, un fragment gravé du chiffre 2. Le poisson s’éteint, satisfait.',
          );
          return;
        }
        if (o2 <= 1) {
          say(`Vos poumons brûlent. Vous n’irez pas plus loin sans respirer. ${o2Text(o2)}`);
          return;
        }
        spend(FISH_STEPS[step], () => setStep(step + 1));
      },
    },
    {
      id: 'breathe',
      label: 'Remonter respirer dans la poche d’air',
      onSelect: () => {
        setO2(O2_MAX);
        say(
          `Vous crevez la surface contre le plafond. L’air sent le chlore et la vieille moquette. ${o2Text(O2_MAX)}${step > 0 ? ' En bas, le poisson tourne en rond en vous attendant.' : ''}`,
        );
      },
    },
    {
      id: 'bed',
      label: 'Fouiller la valise qui flotte',
      onSelect: () =>
        spend(
          'Une brosse à dents, des chaussettes, une carte postale illisible. Rien d’utile.',
          () => undefined,
        ),
    },
  ];

  return (
    <>
      <Prose>
        <p>
          La chambre est pleine d’eau jusqu’au plafond. Les rideaux ondulent comme des algues, une
          valise flotte entre deux eaux. Un petit poisson brille d’une lumière verte et vous
          regarde.
        </p>
        <p>
          Une poche d’air subsiste contre le plafond.{' '}
          <strong className="font-semibold text-amber-soft">{o2Text(o2)}</strong>
          <span aria-hidden className="ml-2 font-mono text-sage">
            {'●'.repeat(o2)}
            {'○'.repeat(O2_MAX - o2)}
          </span>
        </p>
        {step > 0 && step < FISH_STEPS.length && (
          <p className="text-sage">
            Vous avez parcouru {step} étape{step > 1 ? 's' : ''} sur {FISH_STEPS.length} derrière le
            poisson.
          </p>
        )}
        {step >= FISH_STEPS.length && (
          <p className="text-amber-soft">Le poisson s’est immobilisé au-dessus de la bonde.</p>
        )}
        {solved && <p className="text-sage">Le fragment 2 est déjà dans votre poche.</p>}
      </Prose>
      <Choices items={items} />
    </>
  );
}

/* ────────────────────────────── 101 ────────────────────────────── */

interface Drawing {
  id: string;
  label: string;
  word: string;
}
const DRAWINGS: Record<string, Drawing> = {
  hotel: {
    id: 'hotel',
    label: 'Un hôtel au feutre bleu, toutes fenêtres allumées',
    word: 'IL Y A',
  },
  lift: { id: 'lift', label: 'Un ascenseur, avec beaucoup trop de boutons', word: 'UNE CHAMBRE' },
  door: { id: 'door', label: 'Une porte rouge, numérotée 404', word: 'EN TROP' },
};
const SOLUTION = ['hotel', 'lift', 'door'];

function Room101({ say, solve, solved }: SceneProps) {
  const [crouched, setCrouched] = useState(false);
  const [doudou, setDoudou] = useState(false);
  const [order, setOrder] = useState<string[]>(['door', 'hotel', 'lift']);
  const [wallOpen, setWallOpen] = useState(false);
  const message = order.every((id, i) => id === SOLUTION[i]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    const ok = next.every((id, k) => id === SOLUTION[k]);
    const listing = next.map((id, k) => `${k + 1}. ${DRAWINGS[id].word}`).join(', ');
    say(
      ok
        ? `Les mots se lisent enfin à la suite : « IL Y A UNE CHAMBRE EN TROP ». Quelque part, une boîte à musique se remet en route.${doudou ? ' Le doudou, dans vos bras, semble plus lourd.' : ''}`
        : `Nouvel ordre : ${listing}.`,
    );
  };

  const items: Choice[] = [
    {
      id: 'crouch',
      label: crouched ? 'Se relever' : 'S’accroupir près du lit',
      onSelect: () => {
        setCrouched(!crouched);
        say(
          crouched
            ? 'Vous vous relevez. Le mobile au plafond tourne tout seul.'
            : 'Vous vous accroupissez. Sous le lit, il fait plus noir que la nuit. Quelque chose de doux dépasse.',
        );
      },
    },
    ...(crouched && !doudou
      ? [
          {
            id: 'reach',
            label: 'Tendre la main sous le lit',
            primary: true,
            onSelect: () => {
              setDoudou(true);
              say(
                'Vos doigts trouvent une oreille en peluche. Vous tirez : un lapin râpé, un œil en bouton. Le doudou. Il a une fermeture éclair dans le dos.',
              );
            },
          },
        ]
      : []),
    {
      id: 'wall',
      label: wallOpen ? 'Détourner les yeux des dessins' : 'Regarder les dessins au mur',
      onSelect: () => {
        setWallOpen(!wallOpen);
        if (!wallOpen)
          say(
            'Trois dessins d’enfant, punaisés de travers. Sous chacun, un mot au crayon. Dans le désordre.',
          );
      },
    },
    ...(doudou && message
      ? [
          {
            id: 'zip',
            label: 'Ouvrir la fermeture éclair du doudou',
            primary: true,
            onSelect: () =>
              solve(
                'Dans le ventre du lapin, enveloppé de coton : un fragment gravé du chiffre 0. La boîte à musique s’arrête net.',
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Prose>
        <p>
          Papier peint à nuages, veilleuse en forme de lune, petit lit à barreaux. Un mobile tourne
          lentement au plafond, sans courant d’air. Ça sent le talc et la poussière.
        </p>
        {doudou && <p className="text-sage">Vous tenez le doudou contre vous.</p>}
        {solved && <p className="text-sage">Le fragment 0 est déjà dans votre poche.</p>}
      </Prose>

      {wallOpen && (
        <section aria-labelledby="drawings-title" className="mt-8 border border-sage/40 p-4">
          <h2
            id="drawings-title"
            className="font-mono text-xs tracking-[0.25em] text-sage uppercase"
          >
            Les trois dessins, de gauche à droite
          </h2>
          <p className="mt-2 text-sm text-paper/85">
            Changez leur ordre pour que les mots forment une phrase.
          </p>
          <ol className="mt-4 space-y-3">
            {order.map((id, i) => {
              const d = DRAWINGS[id];
              return (
                <li key={id} className="border border-sage/30 p-3">
                  <p>
                    <SrOnly>Dessin {i + 1} : </SrOnly>
                    {d.label}. <span className="font-mono text-amber-soft">« {d.word} »</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Déplacer « ${d.word} » vers la gauche`}
                      className={`${btnBase} ${btnQuiet} w-auto disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ← Gauche
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1}
                      aria-label={`Déplacer « ${d.word} » vers la droite`}
                      className={`${btnBase} ${btnQuiet} w-auto disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      Droite →
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {message && <Inscription>Il y a une chambre en trop.</Inscription>}
        </section>
      )}

      <Choices items={items} />
    </>
  );
}

/* ────────────────────────────── 237 ────────────────────────────── */

function Room237({ say, solve, solved }: SceneProps) {
  const [torch, setTorch] = useState(false);
  const [read, setRead] = useState(false);
  const [bathroom, setBathroom] = useState(false);

  const items: Choice[] = !torch
    ? [
        {
          id: 'grope',
          label: 'Avancer à tâtons',
          onSelect: () =>
            say(
              'Votre main rencontre quelque chose de mou et d’humide. Vous préférez ne pas savoir.',
            ),
        },
        {
          id: 'torch',
          label: 'Allumer la lampe torche',
          primary: true,
          onSelect: () => {
            setTorch(true);
            say(
              'Le faisceau tremble, puis tient. Papier peint décollé, lit éventré, une porte entrouverte sur une salle de bain. Sur le mur, des lettres gravées.',
            );
          },
        },
      ]
    : [
        {
          id: 'read',
          label: 'Lire l’inscription gravée dans le mur',
          onSelect: () => {
            setRead(true);
            say(
              'Gravé profond, au couteau peut-être : « ELLE GARDE CE QUE L’EAU A OUBLIÉ ». En dessous, une date : 1979.',
            );
          },
        },
        bathroom
          ? {
              id: 'tub',
              label: 'Regarder sous la baignoire',
              primary: read,
              onSelect: () =>
                solve(
                  'Vous vous allongez sur le carrelage froid. Le faisceau glisse sous les pieds de lion de la baignoire : un fragment gravé du chiffre 4, posé là comme une offrande.',
                ),
            }
          : {
              id: 'bath',
              label: 'Entrer dans la salle de bain',
              onSelect: () => {
                setBathroom(true);
                say(
                  'Carrelage fendu, miroir couvert de buée qui ne s’évapore jamais. Une baignoire sur pieds, vide et sèche depuis longtemps.',
                );
              },
            },
        {
          id: 'behind',
          label: 'Se retourner',
          onSelect: () =>
            say('Rien. Le faisceau ne montre rien. Mais le papier peint, lui, a bougé.'),
        },
      ];

  return (
    <>
      <Prose>
        <p>
          La porte cède sur une odeur de moisi. Personne n’a dormi ici depuis 1979. Les volets sont
          cloués.{' '}
          {torch
            ? 'Votre lampe torche découpe la pièce en morceaux.'
            : 'Il fait complètement noir.'}
        </p>
        {read && <Inscription>Elle garde ce que l’eau a oublié.</Inscription>}
        {bathroom && (
          <p className="text-sage">Vous êtes dans la salle de bain, devant la baignoire.</p>
        )}
        {solved && <p className="text-sage">Le fragment 4 est déjà dans votre poche.</p>}
      </Prose>
      <Choices items={items} />
    </>
  );
}

export const ROOM_SCENES: Record<Exclude<RoomId, '404'>, ComponentType<SceneProps>> = {
  '001': Room001,
  '013': Room013,
  '042': Room042,
  '101': Room101,
  '237': Room237,
};
