import { useState } from 'react';
import { STICKER_PALETTE, STICKER_LIFETIME_MS } from '../stickers/palette';
import { useStore } from '../state/store';
import { api } from '../api/client';
import type { Sticker } from '@hero-syndrome/shared';

export function StickerPalette() {
  const sessionId = useStore((s) => s.sessionId);
  const addSticker = useStore((s) => s.addSticker);
  const [pulse, setPulse] = useState<string | null>(null);

  const onPick = async (emoji: string): Promise<void> => {
    if (!sessionId) return;
    const placedAt = new Date().toISOString();
    const sticker: Sticker = {
      emoji,
      placedAt,
      decayAt: new Date(Date.now() + STICKER_LIFETIME_MS).toISOString(),
    };
    addSticker(sticker);
    setPulse(emoji);
    window.setTimeout(() => setPulse((p) => (p === emoji ? null : p)), 220);
    if ('vibrate' in navigator) navigator.vibrate(5);
    api.recordSticker(sessionId, emoji).catch(() => undefined);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5 rounded-2xl border border-ink/10 bg-paper/85 px-2 py-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur">
        {STICKER_PALETTE.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition-transform duration-150 active:scale-95 ${pulse === emoji ? 'scale-125' : ''}`}
            aria-label={`drop ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
