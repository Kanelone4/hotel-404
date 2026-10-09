import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useDomReady } from '@/lib/motion/useDomReady';
import { setTitle } from '@/lib/motion/useTitleEasterEgg';
import { useGame } from '@/stores/gameStore';

const CREDITS: [string, string][] = [
  ['Direction', 'Le Gérant'],
  ['Réception', 'Personne'],
  ['Chambre 001', 'Une chambre parfaitement normale'],
  ['Chambre 013', 'La gravité, en congé'],
  ['Chambre 042', 'Le poisson'],
  ['Chambre 101', 'Le doudou (retrouvé)'],
  ['Chambre 237', 'Ce qui vit dans le papier peint'],
  ['Chambre 404', 'Introuvable'],
  ['Son', 'Synthétisé, aucun fichier n’a été blessé'],
  ['Technique', 'React · Three.js · R3F · GLSL · WebAudio'],
];

export default function Credits() {
  useDomReady();
  const setEndingSeen = useGame((s) => s.setEndingSeen);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setEndingSeen();
    setTitle('Check-out — Hôtel 404');
  }, [setEndingSeen]);

  const shareUrl = `${window.location.origin}/?room=404`;
  const share = async () => {
    const data = { title: 'Hôtel 404', text: 'J’ai trouvé la chambre 404. Elle n’existe pas.', url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <main className="grain relative h-full overflow-y-auto bg-black text-paper" style={{ touchAction: 'pan-y' }}>
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center px-6 py-24 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 3 }} className="font-mono text-xs tracking-[0.5em] text-neon uppercase">
          Check-out
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, filter: 'blur(20px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 3, delay: 0.5 }}
          className="mt-6 font-display text-6xl font-light sm:text-8xl"
        >
          Merci de votre séjour.
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 2 }} className="mt-6 text-paper/60">
          Vous n’avez jamais été ici. La chambre 404 n’existe pas.
        </motion.p>

        <dl className="mt-20 w-full space-y-5 font-mono text-sm">
          {CREDITS.map(([k, v], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.5 + i * 0.35 }}
              className="grid grid-cols-2 gap-4 text-left"
            >
              <dt className="text-right text-[11px] tracking-[0.25em] text-sage uppercase">{k}</dt>
              <dd className="text-paper/85">{v}</dd>
            </motion.div>
          ))}
        </dl>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 8 }} className="mt-20 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={share}
            className="border border-amber px-10 py-3 font-mono text-xs tracking-[0.35em] text-amber-soft uppercase hover:bg-amber hover:text-ink"
          >
            {copied ? 'Lien copié' : 'Envoyer quelqu’un à la 404'}
          </button>
          <code className="font-mono text-[11px] text-sage-dim">{shareUrl}</code>
          <Link to="/" className="mt-6 font-mono text-[11px] tracking-widest text-sage underline decoration-dotted hover:text-paper">
            Retourner à la réception
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
