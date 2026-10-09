import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Object3D, ShaderMaterial, Vector3, type Mesh, type SpotLight } from 'three';
import { flash, sharedUniforms, FLASH_ANGLE } from './state';
import { flashCookie } from './textures';

const tmpFwd = new Vector3();
const tmpRight = new Vector3();
const tmpUp = new Vector3();
const tmpHand = new Vector3();
const tmpAim = new Vector3();
const tmpLook = new Vector3();

const CONE_LEN = 5;
const INTENSITY = 34;

/**
 * Hand-held torch: a shadow-casting SpotLight that trails the camera
 * (position snaps, aim lags + sways), with a projected lens cookie and a
 * faint additive cone. Writes `flash` (pos/dir/power) for every shader.
 */
export function Flashlight({ on, exiting, reducedMotion }: { on: boolean; exiting: boolean; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const spot = useRef<SpotLight>(null);
  const cone = useRef<Mesh>(null);
  const target = useMemo(() => new Object3D(), []);
  const cookie = useMemo(flashCookie, []);

  const coneGeo = useMemo(() => {
    const g = new ConeGeometry(Math.tan(FLASH_ANGLE) * CONE_LEN, CONE_LEN, 40, 1, true);
    g.translate(0, -CONE_LEN / 2, 0); // apex at origin
    g.rotateX(-Math.PI / 2); // base toward +Z (Object3D.lookAt points +Z)
    return g;
  }, []);

  const coneMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uPower: { value: 1 }, uLen: { value: CONE_LEN }, uColor: { value: new Color('#ffe9c4') } },
        vertexShader: /* glsl */ `
          uniform float uLen;
          varying vec3 vN;
          varying vec3 vView;
          varying float vAlong;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - wp.xyz);
            vAlong = position.z / uLen; // 0 at the lens, 1 at the far end
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uPower;
          uniform vec3 uColor;
          varying vec3 vN;
          varying vec3 vView;
          varying float vAlong;
          void main() {
            // Volumetric-cone trick: brighter where the surface faces the viewer,
            // fading along the beam and right at the lens.
            float facing = pow(abs(dot(normalize(vN), vView)), 2.0);
            float a = facing * (1.0 - smoothstep(0.0, 1.0, vAlong)) * smoothstep(0.0, 0.1, vAlong);
            gl_FragColor = vec4(uColor * a * uPower * 0.07, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [],
  );

  useEffect(
    () => () => {
      coneGeo.dispose();
      coneMat.dispose();
    },
    [coneGeo, coneMat],
  );

  const s = useRef({
    init: false,
    pos: new Vector3(),
    dir: new Vector3(0, 0, -1),
    level: 1,
    stutterLeft: 0,
    nextStutter: 50 + Math.random() * 30,
    exitT: 0,
  });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const st = s.current;
    sharedUniforms.uTime.value = t;

    camera.getWorldDirection(tmpFwd);
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    // Torch held low on the right, aimed at a point 4m in front of the eye.
    tmpHand.copy(camera.position).addScaledVector(tmpRight, 0.16).addScaledVector(tmpUp, -0.15).addScaledVector(tmpFwd, 0.1);
    tmpAim.copy(camera.position).addScaledVector(tmpFwd, 4).sub(tmpHand).normalize();
    if (!st.init) {
      st.pos.copy(tmpHand);
      st.dir.copy(tmpAim);
      st.init = true;
    }
    st.pos.lerp(tmpHand, 1 - Math.exp(-dt * 30));
    st.dir.lerp(tmpAim, 1 - Math.exp(-dt * 9)).normalize();

    flash.pos.copy(st.pos);
    flash.dir.copy(st.dir);
    if (!reducedMotion) {
      // Breathing sway of the hand.
      flash.dir
        .addScaledVector(tmpRight, Math.sin(t * 1.3) * 0.007 + Math.sin(t * 3.1) * 0.002)
        .addScaledVector(tmpUp, Math.sin(t * 1.7 + 1) * 0.006)
        .normalize();
    }

    // ── Output level ─────────────────────────────────────────────────────
    let level = on ? 1 : 0;

    // Battery stutter (random, or requested by the silhouette).
    st.nextStutter -= dt;
    if (st.nextStutter <= 0 && on) {
      st.stutterLeft = 0.9;
      st.nextStutter = 55 + Math.random() * 40;
    }
    if (flash.stutter > 0) {
      st.stutterLeft = Math.max(st.stutterLeft, flash.stutter);
      flash.stutter = 0;
    }
    if (st.stutterLeft > 0) {
      st.stutterLeft -= dt;
      if (reducedMotion) level *= 0.4 + 0.3 * Math.cos(st.stutterLeft * 4);
      else level *= Math.sin(t * 53) * Math.sin(t * 17.3) > 0.05 ? 0.12 : 0.9;
    }

    // Exit: dies in a few dying sputters (or a smooth fade with reduced motion).
    if (exiting) {
      st.exitT += dt;
      const e = st.exitT;
      if (reducedMotion) level *= Math.max(0, 1 - e / 1.3);
      else if (e < 1.1) level *= Math.sin(e * 41) * Math.sin(e * 13) > 0 ? 0.6 * (1 - e / 1.1) : 0.05;
      else level = 0;
    }

    st.level += (level - st.level) * (1 - Math.exp(-dt * (reducedMotion ? 10 : 45)));
    flash.power = st.level;
    sharedUniforms.uFlashPower.value = st.level;

    const l = spot.current;
    if (l) {
      l.position.copy(flash.pos);
      target.position.copy(flash.pos).addScaledVector(flash.dir, 5);
      target.updateMatrixWorld();
      l.intensity = INTENSITY * st.level;
    }
    const c = cone.current;
    if (c) {
      c.position.copy(flash.pos);
      tmpLook.copy(flash.pos).add(flash.dir);
      c.lookAt(tmpLook);
      coneMat.uniforms.uPower.value = st.level;
      c.visible = st.level > 0.01;
    }
  });

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={spot}
        target={target}
        color="#ffe6bd"
        intensity={INTENSITY}
        distance={16}
        decay={1.6}
        angle={FLASH_ANGLE}
        penumbra={0.55}
        map={cookie}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={0.1}
        shadow-camera-far={14}
      />
      <mesh ref={cone} geometry={coneGeo} material={coneMat} frustumCulled={false} renderOrder={10} raycast={() => null} />
    </>
  );
}
