export function LoadingScreen({ text = 'Le personnel prépare votre chambre…' }: { text?: string }) {
  return (
    <div className="grain fixed inset-0 grid place-items-center overflow-hidden bg-ink">
      <p className="flicker font-mono text-sm tracking-widest text-sage uppercase">{text}</p>
    </div>
  );
}
