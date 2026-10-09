import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Player } from '@/features/hub/Player';
import { player } from '@/features/hub/playerState';
import { useRoom } from '@/features/rooms/useRoom';
import { RoomUI } from '@/features/rooms/RoomUI';
import { Ambient } from '@/lib/audio/Sound';
import { noise } from '@/lib/audio/synth';
import { sfx } from '@/lib/audio/sfx';
import { useQuality } from '@/lib/fx/quality';
import { ui } from '@/stores/uiStore';
import { U } from './corruptMaterial';
import { Post } from './Post';
import { Scenery, COLLIDERS, ROOM, type Act } from './Scenery';
import { Monologue } from './Monologue';
import { Finale } from './Finale';
import { score404 } from './audio404';
import { KEY_LINE, KEY_TALK_LINE, R, SCRIPT, narr, resetR, spike } from './state';

/**
 * Chambre 404 — « Celle qui ne devrait pas exister ».
 *
 * A corrupted collage of the five other rooms. Le Gérant's monologue is read
 * line by line (walking / interacting advances it, a time fallback guarantees
 * it always reaches the end); every line raises the global corruption that
 * drives the geometry, shaders, post-fx, DOM and audio. The hall key appears,
 * opens the 404 door, and the camera takes over for the finale → /credits.
 */
export default function Room404() {
  useRoom('404');
  const { tier, reducedMotion } = useQuality();
  const high = tier === 'high';
  const [doorOpen, setDoorOpen] = useState(false);

  useEffect(() => {
    resetR();
    narr().reset();
    return () => {
      ui().setHint(null);
      narr().reset();
      resetR();
      U.uCorruption.value = 0;
      U.uExplode.value = 0;
      U.uSnap.value = 0;
    };
  }, []);

  useEffect(() => {
    R.reduced = reducedMotion;
  }, [reducedMotion]);

  const progress = useRef({ bonus: 0 });

  const onAct = useCallback((what: Act) => {
    const n = narr();
    if (n.finale) return;
    const bump = () => {
      progress.current.bonus = 1;
      spike(0.45);
    };
    switch (what) {
      case 'door':
        if (!n.keyTaken) {
          sfx.buzz(undefined, 0.35);
          spike(0.3);
          ui().showToast(
            n.keyVisible ? 'Verrouillée. La clé du hall, sur le lit.' : 'Verrouillée. Évidemment.',
          );
          return;
        }
        ui().setHint(null);
        n.startFinale();
        return;
      case 'key':
        n.takeKey();
        sfx.ding(undefined, 0.35);
        ui().showToast('Vous reprenez la clé du hall. Elle est tiède.');
        ui().setHint('La porte 404. La seule sortie.');
        bump();
        return;
      case 'mirror':
        sfx.glitch(undefined, 0.5);
        ui().showToast('Le miroir montre la chambre. Il ne vous montre pas.');
        bump();
        R.spike = 1;
        return;
      case 'drawing':
        sfx.slide(undefined, 0.25);
        ui().showToast('Un dessin d’enfant : l’hôtel, et une porte. 404.');
        bump();
        return;
      case 'water':
        sfx.bubbles(undefined, 0.5);
        ui().showToast('L’eau ne mouille pas. Elle a oublié comment.');
        bump();
        return;
      case 'chair':
        sfx.thud(undefined, 0.3);
        ui().showToast('La chaise de la 013. Elle tombe vers le haut.');
        bump();
        return;
      case 'bed':
        sfx.creak(undefined, 0.35);
        ui().showToast('Le lit de la 001. Encore chaud. Tout est normal.');
        bump();
        return;
    }
  }, []);

  const openDoor = useCallback(() => setDoorOpen(true), []);
  const score = useMemo(() => score404(), []);
  const bed = useMemo(() => noise({ color: 'brown', freq: 180, gain: 0.5 }), []);

  return (
    <>
      <color attach="background" args={['#050307']} />
      <fog attach="fog" args={['#07040a', 2.5, 15]} />

      <Scenery onAct={onAct} doorOpen={doorOpen} high={high} />
      <Finale reduced={reducedMotion} onDoor={openDoor} />
      <Director progress={progress} reduced={reducedMotion} />

      <Player
        start={[0, 0, 3]}
        yaw={0}
        speed={2.4}
        bounds={{ min: [-ROOM.w / 2, 0, -ROOM.d / 2], max: [ROOM.w / 2, 3, ROOM.d / 2] }}
        colliders={COLLIDERS}
      />

      <Post high={high} reduced={reducedMotion} />

      <Ambient sound={score} volume={0.55} fade={3} />
      <Ambient sound={bed} volume={0.25} />

      <RoomUI.In>
        <Monologue reduced={reducedMotion} />
      </RoomUI.In>
    </>
  );
}

/** Reading time for a line (s). */
const readTime = (i: number) => 3.2 + SCRIPT[i].text.length * 0.045;
const FIRST_LINE_AT = 2.5;
/** After the last line: auto-take the key, then auto-start the finale. */
const AUTO_KEY_AFTER = 14;
const AUTO_FINALE_AFTER = 30;

/**
 * Narration + corruption driver. Runs every frame, never re-renders.
 *
 * Next line when: the current one had time to be read AND (the player walked
 * ~3 m, or interacted with something, or the fallback delay elapsed).
 */
function Director({
  progress,
  reduced,
}: {
  progress: MutableRefObject<{ bonus: number }>;
  reduced: boolean;
}) {
  const st = useRef({
    nt: 0,
    lastLine: 0,
    dist: 0,
    lx: NaN,
    lz: 0,
    lastShownAt: 0,
    hinted: false,
    autoKey: false,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    const u = ui();
    const n = narr();
    R.time += dt;

    const live = !u.transition.active && !u.paused && !u.note;
    if (live && !n.finale) {
      s.nt += dt;
      if (!s.hinted) {
        s.hinted = true;
        u.setHint('Il parle. Marchez, regardez, touchez.');
        window.setTimeout(() => {
          if (ui().hint?.startsWith('Il parle')) ui().setHint(null);
        }, 7000);
      }

      // Distance walked since the last line.
      const p = player.position;
      if (!Number.isNaN(s.lx)) s.dist += Math.hypot(p.x - s.lx, p.z - s.lz);
      s.lx = p.x;
      s.lz = p.z;

      const idx = n.index;
      const last = SCRIPT.length - 1;
      const since = s.nt - s.lastLine;
      if (idx < 0) {
        if (s.nt >= FIRST_LINE_AT) advance(0);
      } else if (idx < last) {
        const minGap = readTime(idx);
        const fallback = minGap + 6.5;
        // The key must be in sight before le Gérant talks about it.
        const blocked = idx + 1 === KEY_TALK_LINE && !n.keyVisible;
        if (
          !blocked &&
          since >= minGap &&
          (s.dist > 3 || progress.current.bonus > 0 || since >= fallback)
        )
          advance(idx + 1);
      } else {
        // Everything has been said: make sure everyone reaches the end.
        if (!n.keyTaken && since > AUTO_KEY_AFTER && !s.autoKey) {
          s.autoKey = true;
          n.takeKey();
          sfx.ding(undefined, 0.3);
          u.showToast('La clé du hall est dans votre poche. Elle l’a toujours été.');
          u.setHint('La porte 404. La seule sortie.');
        }
        if (since > AUTO_FINALE_AFTER) {
          u.showToast('La porte s’ouvre toute seule.');
          u.setHint(null);
          n.startFinale();
        }
      }
    }

    function advance(i: number) {
      n.setIndex(i);
      if (i === KEY_LINE) {
        n.showKey();
        ui().setHint('Quelque chose brille sur le lit.');
      }
      s.lastLine = s.nt;
      s.dist = 0;
      progress.current.bonus = 0;
      spike(0.2 + R.corruption * 0.3);
      sfx.glitch(undefined, 0.12 + R.corruption * 0.25);
    }

    // ── Corruption ──────────────────────────────────────────────────────
    const N = SCRIPT.length;
    const idx = n.index;
    const step = 0.86 / N;
    const inLine =
      idx >= 0 ? Math.min(1, (s.nt - s.lastLine) / (readTime(Math.min(idx, N - 1)) + 6.5)) : 0;
    let target = 0.04 + step * (idx + 1) + step * 0.8 * inLine;
    if (n.finale) target = 1;
    R.corruption +=
      (Math.min(1, target) - R.corruption) * (1 - Math.exp(-dt * (n.finale ? 1.5 : 0.6)));
    R.spike *= Math.exp(-dt * 2.4);
    // Spontaneous micro-crashes at high corruption.
    if (!reduced && live && Math.random() < dt * R.corruption * R.corruption * 0.5) {
      spike(0.35);
      sfx.glitch(undefined, 0.08 + R.corruption * 0.15);
    }

    const c = Math.min(1, R.corruption + R.spike * 0.25);
    U.uTime.value = R.time;
    U.uCorruption.value = c;
    U.uExplode.value = R.explode;
    U.uSnap.value = c > 0.12 ? (reduced ? 420 - c * 220 : 420 - c * 340) : 0;
    U.uRate.value = reduced ? 0.25 : 1;
  });

  return null;
}
