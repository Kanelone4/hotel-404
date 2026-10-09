import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, ShaderMaterial, type Group } from 'three';
import { Interactable } from '@/lib/interaction/Interactable';
import { Spatial } from '@/lib/audio/Sound';
import { sfx } from '@/lib/audio/sfx';
import { INSCRIPTION } from './layout';
import { inscriptionMask, paperStrip, plasterPatch } from './textures';
import { curledStrip } from './geometry';
import { sharedUniforms, FLASH_GLSL, flash } from './state';
import { breathing, sfx237 } from './audio';

const { x: IX, y: IY, z: IZ, w: IW, h: IH } = INSCRIPTION;
const COVER = { w: 1.55, h: 1.35, top: IY + IH / 2 + 0.25 };

/**
 * The wall above the mattress: a bulging sheet of wallpaper hides the
 * plaster. Torn off, it reveals carvings that only exist under the torch:
 * the shader shades the gouges from the flashlight position (fake relief)
 * and fades them to nothing outside the beam.
 */
export function Inscription({
  torn,
  read,
  onTear,
  onRead,
  dead,
}: {
  torn: boolean;
  read: boolean;
  onTear: () => void;
  onRead: () => void;
  dead: boolean;
}) {
  const mask = useMemo(inscriptionMask, []);
  const patch = useMemo(plasterPatch, []);
  const coverTex = useMemo(() => paperStrip(237), []);
  const coverGeo = useMemo(() => curledStrip(COVER.w, COVER.h, 0.05, 0.045), []);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...sharedUniforms, uMask: { value: mask } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          ${FLASH_GLSL}
          uniform sampler2D uMask;
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            float f = flashAt(vWorld);
            float m = texture2D(uMask, vUv).r;
            // The plane lies in world XY facing +Z (no rotation), so the light
            // direction's XY is its tangent-space direction.
            vec3 L = normalize(uFlashPos - vWorld);
            vec2 lt = normalize(L.xy + vec2(1e-4));
            vec2 texel = vec2(1.0 / 1024.0, 1.0 / 640.0) * 3.0;
            float mPrev = texture2D(uMask, vUv - lt * texel).r;
            // Groove wall facing the light catches it; the opposite lip falls in shadow.
            float edge = clamp((m - mPrev) * 2.5, -1.0, 1.0);
            float grazing = 1.0 - abs(L.z); // raking light = deeper relief
            vec3 col = vec3(0.52, 0.49, 0.43) * (0.15 + f) * (1.0 - m * 0.8);
            col += vec3(1.0, 0.92, 0.75) * max(edge, 0.0) * f * (0.5 + grazing);
            col *= 1.0 - max(-edge, 0.0) * 0.7;
            // Legible only in the beam; a ghost of it otherwise.
            float alpha = m * (0.04 + smoothstep(0.03, 0.3, f) * 0.96);
            gl_FragColor = vec4(col, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [mask],
  );

  useEffect(
    () => () => {
      mat.dispose();
      coverGeo.dispose();
    },
    [mat, coverGeo],
  );

  // ── Tear animation of the cover sheet ────────────────────────────────
  const cover = useRef<Group>(null);
  const tearT = useRef(-1);
  useEffect(() => {
    if (torn && tearT.current < 0) tearT.current = 0;
  }, [torn]);

  useFrame((_, rawDt) => {
    const g = cover.current;
    if (!g) return;
    if (tearT.current < 0) {
      // Slight breathing bulge before it is torn (something behind?).
      g.rotation.x = -0.015 - Math.sin(performance.now() * 0.0011) * 0.008;
      return;
    }
    tearT.current += Math.min(rawDt, 0.05);
    const t = tearT.current;
    if (t < 0.35) {
      g.rotation.x = -0.55 * (t / 0.35);
    } else {
      const u = Math.min((t - 0.35) / 0.95, 1);
      const e = u * u; // gravity-ish
      g.position.set(IX + 0.1 * e, COVER.top + (0.26 - COVER.top) * e, IZ + 0.025 + 0.2 * e);
      g.rotation.x = -0.55 + (-Math.PI / 2 + 0.06 + 0.55) * Math.min(1, u * 1.3);
      g.rotation.z = Math.sin(u * 5) * 0.15 * (1 - u) + 0.12 * e;
    }
  });

  const tear = () => {
    sfx237.tear([IX, IY, IZ + 0.2], 0.7);
    window.setTimeout(() => sfx.slide([IX, 0.3, IZ + 0.6], 0.2), 900);
    onTear();
  };

  const readIt = () => {
    if (flash.power < 0.3) {
      sfx.creak([IX, IY, IZ], 0.2);
      return;
    }
    onRead();
  };

  return (
    <group>
      {/* Bare plaster under the wallpaper */}
      <mesh position={[IX, IY, IZ + 0.004]} raycast={() => null}>
        <planeGeometry args={[IW + 0.35, IH + 0.4]} />
        <meshStandardMaterial map={patch} transparent alphaTest={0.4} roughness={1} />
      </mesh>

      {/* Carvings — interactable once uncovered */}
      <Interactable label={read ? 'Relire les entailles' : 'Lire les entailles'} distance={2.6} disabled={!torn} onInteract={readIt}>
        <mesh position={[IX, IY, IZ + 0.008]} material={mat} renderOrder={2}>
          <planeGeometry args={[IW, IH]} />
        </mesh>
      </Interactable>

      {/* The cover sheet */}
      <Interactable label="Arracher le papier peint" distance={2.4} disabled={torn} onInteract={tear}>
        <group ref={cover} position={[IX, COVER.top, IZ + 0.025]}>
          <mesh geometry={coverGeo} castShadow>
            <meshStandardMaterial map={coverTex} alphaTest={0.5} side={DoubleSide} roughness={0.95} />
          </mesh>
        </group>
      </Interactable>

      {/* Breathing inside the wall — louder once the plaster is bare */}
      <Spatial sound={breathing()} position={[IX, IY, IZ - 0.1]} volume={dead ? 0 : torn ? 0.5 : 0.25} refDistance={0.7} rolloff={2} />
    </group>
  );
}
