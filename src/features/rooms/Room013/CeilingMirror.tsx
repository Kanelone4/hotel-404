import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, PlaneGeometry, Vector3, Vector2, type ShaderMaterial } from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Interactable } from '@/lib/interaction/Interactable';
import { MIRROR, MIRROR_Y, KEY_REFLECTION, insideMirror } from './layout';

/**
 * Antique mirror shader for the three.js Reflector:
 *  - projective lookup into the reflection render target (tDiffuse),
 *  - a permanent faint shimmer (the glass is never quite still),
 *  - a circular ripple (uRipple, decays) when the player "touches" the reflection,
 *  - oxidized, darkened silvering toward the border.
 */
const MirrorShader = {
  name: 'Room013Mirror',
  uniforms: {
    color: { value: null as Color | null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uRipple: { value: 0 },
    uRippleCenter: { value: new Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUvProj;
    varying vec2 vUv0;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv0 = uv;
      vUvProj = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uRipple;
    uniform vec2 uRippleCenter;
    varying vec4 vUvProj;
    varying vec2 vUv0;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      // Ripple: concentric rings travelling out from the touch point.
      float d = distance(vUv0, uRippleCenter);
      float ring = sin(d * 55.0 - uTime * 9.0) * exp(-d * 4.0) * uRipple;
      // Shimmer: two slow crossed sines.
      vec2 shimmer = vec2(
        sin(vUv0.y * 24.0 + uTime * 0.7),
        sin(vUv0.x * 19.0 - uTime * 0.55)
      ) * 0.0035;
      vec4 p = vUvProj;
      p.xy += (shimmer + normalize(vUv0 - uRippleCenter + 1e-4) * ring * 0.035) * p.w;
      vec3 refl = texture2DProj(tDiffuse, p).rgb * color;
      // Oxidized border.
      vec2 e = abs(vUv0 - 0.5) * 2.0;
      float edge = smoothstep(0.78, 1.0, max(e.x, e.y));
      float spots = 0.5 + 0.5 * sin(vUv0.x * 63.0) * sin(vUv0.y * 41.0);
      refl = mix(refl, refl * 0.35 + vec3(0.04, 0.035, 0.03), edge * (0.6 + 0.4 * spots));
      // Light flash on the ripple crest.
      refl += vec3(1.0, 0.8, 0.55) * max(ring, 0.0) * 0.25;
      gl_FragColor = vec4(refl, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export interface CeilingMirrorProps {
  /** Key still glued overhead → its reflection can be grabbed. */
  armed: boolean;
  onGrabReflection: () => void;
  quality: 'high' | 'low';
}

const tmpCam = new Vector3();

/**
 * The mirror that was above the bed now lies in the player's floor. It shows
 * the room right-side-up. Below it — inside it — sits an invisible proxy at
 * the key's virtual image: aim at the reflection of the key to take it.
 */
export function CeilingMirror({ armed, onGrabReflection, quality }: CeilingMirrorProps) {
  const camera = useThree((s) => s.camera);
  const [visible, setVisible] = useState(false);
  const rippleT = useRef(0);

  const reflector = useMemo(() => {
    const size = quality === 'high' ? 1024 : 512;
    const r = new Reflector(new PlaneGeometry(MIRROR.w, MIRROR.d), {
      color: new Color('#cfd8d4'),
      textureWidth: size,
      textureHeight: size,
      clipBias: 0.003,
      multisample: quality === 'high' ? 4 : 0,
      shader: MirrorShader,
    });
    r.rotation.x = -Math.PI / 2;
    r.position.set(MIRROR.cx, MIRROR_Y, MIRROR.cz);
    return r;
  }, [quality]);

  useEffect(() => () => reflector.dispose(), [reflector]);

  useFrame(({ clock }, dt) => {
    const mat = reflector.material as ShaderMaterial;
    mat.uniforms.uTime.value = clock.elapsedTime;
    rippleT.current = Math.max(0, rippleT.current - dt * 0.45);
    mat.uniforms.uRipple.value = rippleT.current;

    // Is the key's reflection actually seen *through* the glass? Intersect the
    // eye→virtual-image segment with the mirror plane and test the rectangle.
    let v = false;
    if (armed) {
      camera.getWorldPosition(tmpCam);
      const [rx, ry, rz] = KEY_REFLECTION;
      const t = (tmpCam.y - MIRROR_Y) / (tmpCam.y - ry);
      if (t > 0 && t < 1) {
        const x = tmpCam.x + (rx - tmpCam.x) * t;
        const z = tmpCam.z + (rz - tmpCam.z) * t;
        v = insideMirror(x, z, 0.08);
      }
    }
    if (v !== visible) setVisible(v);
  });

  const grab = () => {
    // Ripple centred on where the reflection sits in the glass (plane UV).
    const [rx, , rz] = KEY_REFLECTION;
    const mat = reflector.material as ShaderMaterial;
    (mat.uniforms.uRippleCenter.value as Vector2).set(
      (rx - MIRROR.cx) / MIRROR.w + 0.5,
      // PlaneGeometry v runs along +Y, which becomes −Z after the −π/2 X rotation.
      -(rz - MIRROR.cz) / MIRROR.d + 0.5,
    );
    rippleT.current = 1;
    onGrabReflection();
  };

  return (
    <group>
      <primitive object={reflector} />
      <MirrorFrame />
      {armed && (
        <Interactable
          label="Saisir le reflet de la clé"
          distance={7}
          disabled={!visible}
          position={KEY_REFLECTION}
          onInteract={grab}
        >
          <mesh>
            <sphereGeometry args={[0.28, 10, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Interactable>
      )}
    </group>
  );
}

/** Gilded frame, flush with the floor. */
function MirrorFrame() {
  const t = 0.09;
  const { cx, cz, w, d } = MIRROR;
  const bars: [number, number, number, number][] = [
    [cx, cz - d / 2 - t / 2, w + 2 * t, t],
    [cx, cz + d / 2 + t / 2, w + 2 * t, t],
    [cx - w / 2 - t / 2, cz, t, d],
    [cx + w / 2 + t / 2, cz, t, d],
  ];
  return (
    <group>
      {bars.map(([x, z, bw, bd], i) => (
        <mesh key={i} position={[x, 0.012, z]}>
          <boxGeometry args={[bw, 0.024, bd]} />
          <meshStandardMaterial color="#a9802f" metalness={0.85} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}
