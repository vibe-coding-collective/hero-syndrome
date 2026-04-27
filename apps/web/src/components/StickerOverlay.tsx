import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { decayOpacity, decayScale } from '../stickers/decay';

interface FloatingPos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function StickerOverlay() {
  const stickers = useStore((s) => s.stickers);
  const pruneStickers = useStore((s) => s.pruneStickers);
  const [, setTick] = useState(0);
  const [positions] = useState(() => new Map<string, FloatingPos>());

  useEffect(() => {
    let raf: number;
    const loop = (): void => {
      const now = Date.now();
      pruneStickers(now);
      for (const sticker of stickers) {
        const k = sticker.placedAt + sticker.emoji;
        if (!positions.has(k)) {
          positions.set(k, {
            x: 0.18 + Math.random() * 0.64,
            y: 0.18 + Math.random() * 0.5,
            vx: (Math.random() - 0.5) * 0.0006,
            vy: (Math.random() - 0.5) * 0.0006,
          });
        }
        const p = positions.get(k)!;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0.05 || p.x > 0.95) p.vx *= -1;
        if (p.y < 0.05 || p.y > 0.85) p.vy *= -1;
      }
      setTick((t) => t + 1);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [stickers, pruneStickers, positions]);

  const now = Date.now();
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {stickers.map((sticker) => {
        const k = sticker.placedAt + sticker.emoji;
        const pos = positions.get(k);
        if (!pos) return null;
        const op = decayOpacity(sticker, now);
        const sc = decayScale(sticker, now);
        return (
          <div
            key={k}
            className="absolute select-none text-5xl drop-shadow-md transition-transform duration-200"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              opacity: op,
              transform: `translate(-50%, -50%) scale(${sc})`,
            }}
          >
            {sticker.emoji}
          </div>
        );
      })}
    </div>
  );
}
