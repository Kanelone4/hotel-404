# Hôtel 404 — Room authoring guide

Each room is a **code-split React component** rendered inside the single shared R3F `<Canvas>`
(owned by `src/features/hub/Experience.tsx`). The room is mounted at `/room/:id` via
`src/features/rooms/registry.ts` (`React.lazy`). A room renders a *complete* scene: background,
fog, lights, geometry, `<Player/>`, post-processing, audio and its DOM UI.

Stack (pinned): React 18.3, three 0.169, @react-three/fiber 8.17, @react-three/drei 9.117,
@react-three/postprocessing 2.16 (postprocessing 6.36), @react-three/rapier 1.5, gsap 3.12,
maath 0.10, framer-motion 11, zustand 5, Tailwind 4. TypeScript strict. Path alias `@/` = `src/`.

## Contract

```tsx
// src/features/rooms/Room042/Room042.tsx
export default function Room042() {
  const { complete, exiting, completed } = useRoom('042');
  return (
    <>
      <color attach="background" args={['#04121f']} />
      <fog attach="fog" args={['#04121f', 2, 18]} />
      {/* lights, meshes… */}
      <Player start={[0, 0, 3]} bounds={{ min: [-4, 0, -4], max: [4, 3, 4] }} />
      <EffectComposer>…</EffectComposer>
      <Ambient sound={synth.noise({ color: 'brown', freq: 300 })} volume={0.4} />
      <RoomUI.In>{/* DOM overlay, e.g. oxygen gauge */}</RoomUI.In>
    </>
  );
}
```

* Everything you mount is unmounted when leaving — clean up timers/listeners in effects.
* Camera defaults are reset on every scene change (fov 70, near 0.05, far 200). Override in an effect if needed.
* Shadows are enabled on the Canvas (`shadows`) — opt in per light/mesh (`castShadow`), keep it cheap.
* Tone mapping: ACES filmic, sRGB output. Emissive + `<Bloom luminanceThreshold≈0.8 mipmapBlur/>` gives glow.
  Use `toneMapped={false}` on materials that must glow very bright.
* No external assets: geometry from primitives / drei helpers, textures from `@/lib/textures/procedural`
  (canvas-generated), sounds from `@/lib/audio/synth` + `sfx` (WebAudio-synthesized). Fonts for drei
  `<Text>`: `FONT_MONO`, `FONT_DISPLAY` from `@/lib/loaders/fonts` (**always pass `font=`**, never let troika fetch from CDN).

## Lifecycle — `useRoom(id)` (`@/features/rooms/useRoom`)

```ts
const { room, complete, leave, completed, exiting } = useRoom('013');
complete({ exitDelay: 4200 }); // award fragment + reward card + travel back to hall after exitDelay ms
```
* `exiting` is true between `complete()` and the transition — play the room's **exit effect** then
  (013: world flips back; 042: water drains; 237: lights die …). Choose `exitDelay` to fit (≥ 3000 recommended).
* `completed` = room already completed in a previous visit (fragment won't be re-awarded; the puzzle should
  still be playable).
* Room 404 does not call `complete()`; it travels to `/credits` itself (see travel below).

## Player — `<Player/>` (`@/features/hub/Player`) + `player` state (`@/features/hub/playerState`)

```tsx
<Player
  start={[0, 0, 3]}      // feet position
  yaw={0}                // 0 looks toward -Z, Math.PI toward +Z
  mode="walk"            // 'walk' | 'swim' | 'locked'
  speed={2.6}
  eyeHeight={1.62} crouchHeight={0.75}  // C / Ctrl crouches (walk mode)
  floorY={0}
  bounds={{ min: [x,y,z], max: [x,y,z] }}   // feet clamp (y used in swim)
  colliders={[{ min, max }, …]}              // AABBs (circle-vs-box in XZ, y-range checked)
  roll={0}               // camera roll; Math.PI = upside-down view (mouse look auto-mirrors)
  footsteps
/>
```
* `swim`: free 3D with inertia/drag; you move where you look; Space up, C/Ctrl down; bounds clamp in 3D; position = eye.
* `player` (mutable singleton, read in `useFrame`): `position` (feet), `eye`, `velocity`, `yaw`, `pitch`, `roll`,
  `crouching`, `crouchAmount` (0..1), `controlsCamera` (set false to drive the camera yourself for a cutscene —
  restore true after), `movementEnabled`.
* Input (`@/lib/input/input`): `input.forward/strafe/up/down/sprint`, `onInteract(fn)`.
  Keys use `KeyboardEvent.code` (WASD on QWERTY = ZQSD on AZERTY).

## Interaction — `<Interactable/>` (`@/lib/interaction/Interactable`)

Center-screen raycast (crosshair). Click (pointer locked), **E**, or the touch ✋ button triggers it.
```tsx
<Interactable label="Ouvrir le tiroir" distance={2.2} disabled={false}
  onHoverChange={(h) => setHover(h)} onInteract={() => open()} position={[…]} rotation={[…]}>
  <mesh>…</mesh>
</Interactable>
```
The first hit along the ray occludes what's behind it — large meshes in front block interactables.

## UI store — `ui()` / `useUI` (`@/stores/uiStore`)

* `ui().showNote({ title?, body, variant?: 'paper' | 'child' | 'engraving' | 'system' })` — readable modal (pauses input).
* `ui().showToast(text)` — short message, top center.
* `ui().setHint(text | null)` — contextual mini-tutorial, bottom center. **Clear it on unmount.**
* `useUI(s => s.transition.active)` — the curtain is still down (don't start timed events before it lifts).
* `<RoomUI.In>…</RoomUI.In>` (`@/features/rooms/RoomUI`) — portal DOM into the HUD layer above the canvas
  (`pointer-events: none` container; add `pointer-events-auto` if you need clicks — remember pointer lock).
  Tailwind tokens: `ink, night, sage, sage-dim, amber, amber-soft, neon, deep, paper`; fonts `font-mono`,
  `font-sans`, `font-display`.

## Game store — `useGame` / `game()` (`@/stores/gameStore`)
`fragments`, `completedRooms`, `visitedRooms`, `room404Unlocked`, `reducedMotion`, `muted`, `setEndingSeen()` …
**Respect `reducedMotion`** (`useQuality().reducedMotion`): tone down shake, flashes, strong chromatic aberration.

## Quality — `useQuality()` (`@/lib/fx/quality`)
`{ tier: 'high'|'low', reducedMotion, particles (multiplier), heavyFx }`. Scale particle counts; skip DOF / godrays /
heavy passes when `!heavyFx`. `EffectComposer multisampling={tier==='high' ? 4 : 0}`.

## Audio (`@/lib/audio`)
* `<Ambient sound={factory} volume fade/>` — non-spatial bed (fades in/out on mount/unmount).
* `<Spatial sound={factory} position volume refDistance rolloff/>` — THREE.PositionalAudio, follows its parent.
* Factories (`synth.*`): `noise({color,type,freq,q,gain})`, `wind()`, `drone({freqs,type,cutoff,gain})`, `neonHum()`,
  `musicBox({notes,root,bpm})`, `sporadic(fire,{min,max})`, wrappers `withReverb(f,{reverse})`, `muffled(f,cutoff)`.
  You can write your own `SynthFactory = (ctx: AudioContext) => { output: AudioNode; stop(): void }` in the room folder.
* One-shots `sfx.*(at?: [x,y,z], volume?)`: `ding, click, buzz, thud, creak, slide, drip, bubbles, glitch, step,
  heartbeat(v), whoosh(v), rumble(v,dur), reward(v)`. Pass `at` for spatialized.
* Mute / unlock are global — nothing to do.

## Travel (`@/lib/motion/travel`)
`travel('/credits', { text, style: 'fade'|'glitch'|'elevator', delay })` — covers screen, navigates, reveals.

## Textures (`@/lib/textures/procedural`)
`carpet(repeat, palette)`, `wallpaper(repeat, base, ink, seed)`, `wood(repeat, tone, seed)`, `tiles(...)`,
`noiseMap(repeat, scale, seed)` (linear data), `glow(color)`, and `canvasTexture(key, size, draw, opts)` for custom ones
(cached by key — use unique keys), `rng(seed)`, `speckle()`.

## Rules for room authors
* Only touch files inside your own room folder. If a shared change is truly required, describe it in your report.
* Keep draw calls reasonable (instancing for repeated objects, merged static geometry where easy).
* Comment shaders. Keep TS strict-clean: `npx tsc --noEmit` must show no errors in your folder.
* French copy (the experience is in French), short and atmospheric.
