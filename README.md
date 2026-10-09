# Hôtel 404

Expérience web 3D immersive en vue première personne : un hôtel qui n'apparaît sur aucune carte.
Chaque chambre est une scène R3F code-splittée, avec sa physique, ses shaders, son post-processing
et son sound design synthétisé (aucun fichier audio, aucune texture téléchargée).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc strict + build Vite → dist/
npm run lint
```

Déploiement : Vercel (SPA, `vercel.json` réécrit tout vers `index.html`).

## Parcours

`/` accueil 2D (débloque l'audio) → `/hall` (FPS) → ascenseur (panneau 3D) → `/room/:id` →
fragment → retour au hall (qui change) → … → `/room/404` (5 fragments) → `/credits` (partage `?room=404`).
`/lite` : version texte accessible, progression partagée.

| Chambre | Mécanique | Fragment |
|---|---|---|
| 001 La chambre normale | lampe, tiroir, oreiller | 1 |
| 013 Tout est à l'envers | monde retourné, Rapier, miroir | 3 |
| 042 Sous l'eau | nage, oxygène, poisson guide, caustiques | 2 |
| 101 Chambre d'enfant | s'accroupir, puzzle de dessins, RenderTexture | 0 |
| 237 Abandonnée | lampe torche, inscription, tension | 4 |
| 404 | corruption shader + DOM, cutscene finale | — |

## Contrôles

ZQSD / WASD (touches physiques), souris (Pointer Lock), E ou clic pour interagir, C / Ctrl s'accroupir
(ou descendre en nage), Espace monter (nage), Maj courir, F lampe (237), Échap pause.
Mobile : joystick, glisser pour regarder, bouton ✋, gyroscope optionnel.

## Architecture

```
src/app/            router (data router), App
src/features/intro  accueil 2D animé
src/features/hub    Experience (Canvas persistant), Hall, Elevator, Player, playerState
src/features/rooms  registry (React.lazy), useRoom, RoomUI (tunnel DOM), Room001…Room404
src/features/outro  crédits + partage
src/features/lite   version texte accessible
src/lib/audio       moteur WebAudio + PositionalAudio, synthés procéduraux, sfx
src/lib/input       clavier / souris / tactile
src/lib/interaction raycast centre écran + <Interactable/>
src/lib/motion      travel() (transitions), titre d'onglet
src/lib/textures    textures canvas procédurales
src/stores          gameStore (persisté localStorage), uiStore
```

Écrire une chambre : voir [`docs/ROOM_API.md`](docs/ROOM_API.md).

En dev, `window.__hotel` expose les stores, le joueur et `travel()` pour le debug.
