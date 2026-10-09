import { useMemo } from 'react';
import { canvasTexture, rng } from '@/lib/textures/procedural';
import { Interactable } from '@/lib/interaction/Interactable';
import { ui } from '@/stores/uiStore';
import { useGame } from '@/stores/gameStore';
import { ROOMS } from '@/features/rooms/registry';
import type { RoomId } from '@/types/game';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** One naive oil-ish painting per completed room. */
const ART: Record<Exclude<RoomId, '404'>, Draw> = {
  '001': (ctx, w, h) => {
    ctx.fillStyle = '#3b4a44';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9c9a3';
    ctx.fillRect(w * 0.15, h * 0.55, w * 0.7, h * 0.2);
    ctx.fillStyle = '#8b3a2a';
    ctx.fillRect(w * 0.15, h * 0.5, w * 0.25, h * 0.08);
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.35, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },
  '013': (ctx, w, h) => {
    ctx.fillStyle = '#2b2233';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h * 0.3);
    ctx.scale(1, -1);
    ctx.fillStyle = '#c58a35';
    ctx.fillRect(-w * 0.2, -h * 0.05, w * 0.4, h * 0.1);
    ctx.fillRect(-w * 0.2, -h * 0.25, w * 0.08, h * 0.2);
    ctx.restore();
    ctx.strokeStyle = '#8fa89a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.15);
    ctx.lineTo(w * 0.9, h * 0.15);
    ctx.stroke();
  },
  '042': (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b6c8f');
    g.addColorStop(1, '#06162a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, w * 0.14, h * 0.06, 0, 0, Math.PI * 2);
    ctx.moveTo(w * 0.62, h * 0.55);
    ctx.lineTo(w * 0.72, h * 0.48);
    ctx.lineTo(w * 0.72, h * 0.62);
    ctx.fill();
    const r = rng(4);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(r() * w, r() * h * 0.5, 2 + r() * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  '101': (ctx, w, h) => {
    ctx.fillStyle = '#efe4c8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a4d8f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.45, w * 0.16, 0, Math.PI * 2);
    ctx.arc(w * 0.38, h * 0.3, w * 0.06, 0, Math.PI * 2);
    ctx.moveTo(w * 0.68, h * 0.3);
    ctx.arc(w * 0.62, h * 0.3, w * 0.06, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c4593a';
    ctx.font = `${h * 0.08}px serif`;
    ctx.fillText('maman', w * 0.3, h * 0.85);
  },
  '237': (ctx, w, h) => {
    ctx.fillStyle = '#14110e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4d4033';
    ctx.fillRect(w * 0.35, h * 0.2, w * 0.3, h * 0.7);
    ctx.fillStyle = '#000';
    ctx.fillRect(w * 0.38, h * 0.24, w * 0.24, h * 0.66);
    ctx.fillStyle = '#e8e0c8';
    ctx.beginPath();
    ctx.arc(w * 0.46, h * 0.45, 2.5, 0, Math.PI * 2);
    ctx.arc(w * 0.54, h * 0.45, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },
};

const SLOTS: Exclude<RoomId, '404'>[] = ['001', '013', '042', '101', '237'];

/**
 * Five frames on the right wall. Empty at first; each completed room hangs
 * its painting — the hall remembers where you have been.
 */
export function Paintings() {
  const completed = useGame((s) => s.completedRooms);
  const textures = useMemo(
    () =>
      Object.fromEntries(
        SLOTS.map((id) => [
          id,
          canvasTexture(`painting-${id}`, [192, 240], (ctx, w, h) => {
            ART[id](ctx, w, h);
            // Varnish + craquelure
            const r = rng(Number(id) + 3);
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            for (let i = 0; i < 40; i++) {
              ctx.beginPath();
              const x = r() * w;
              const y = r() * h;
              ctx.moveTo(x, y);
              ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
              ctx.stroke();
            }
          }),
        ]),
      ),
    [],
  );

  return (
    <group>
      {SLOTS.map((id, i) => {
        const has = completed.includes(id);
        const z = -7.5 + i * 2.6;
        return (
          <Interactable
            key={id}
            label={has ? `« Chambre ${id} »` : 'Cadre vide'}
            distance={3.5}
            onInteract={() =>
              ui().showToast(has ? `« Chambre ${id} — ${ROOMS[id].name} ». Huile sur toile. Signé : vous.` : 'Un cadre vide. Une plaque gravée : « bientôt ».')
            }
            position={[HALL_X - 0.04, 2.35, z]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.95, 1.18, 0.06]} />
              <meshStandardMaterial color="#8a6a2e" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.032]}>
              <planeGeometry args={[0.8, 1.0]} />
              {has ? (
                <meshStandardMaterial map={textures[id]} roughness={0.55} />
              ) : (
                <meshStandardMaterial color="#141412" roughness={1} />
              )}
            </mesh>
            {/* Picture light */}
            <mesh position={[0, 0.68, 0.1]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.02, 0.02, 0.4]} />
              <meshStandardMaterial color="#c79a45" metalness={0.9} roughness={0.3} emissive={has ? '#ffcf7a' : '#000'} emissiveIntensity={0.4} />
            </mesh>
          </Interactable>
        );
      })}
    </group>
  );
}

const HALL_X = 7;
