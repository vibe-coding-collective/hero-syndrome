import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { EpisodeRes } from '@hero-syndrome/shared';
import { api, episodeSongStreamUrl } from '../api/client';
import { AudioEngine } from '../audio/engine';
import SourcesFootnotes from '../components/SourcesFootnotes';

export default function Episode() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EpisodeRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const enqueueIdxRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .episode(id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [id]);

  const onPlay = async (): Promise<void> => {
    if (!data || !id) return;
    if (data.songs.length === 0) return;
    if (playing) return;
    const engine = new AudioEngine({
      onSongStart: (songId) => {
        const idx = data.songs.findIndex((s) => s.songId === songId);
        if (idx >= 0) setCurrentIdx(idx);
      },
      onNeedNext: async () => {
        const next = enqueueIdxRef.current + 1;
        if (!data.songs[next]) return;
        const url = episodeSongStreamUrl(id, data.songs[next].songId);
        try {
          await engine.enqueue(url, data.songs[next].songId);
          enqueueIdxRef.current = next;
        } catch (err) {
          console.error('episode enqueue failed', err);
        }
      },
    });
    engineRef.current = engine;
    enqueueIdxRef.current = 0;
    setPlaying(true);
    setCurrentIdx(0);
    await engine.start(episodeSongStreamUrl(id, data.songs[0]!.songId), data.songs[0]!.songId);
  };

  const onPause = async (): Promise<void> => {
    setPlaying(false);
    setCurrentIdx(null);
    engineRef.current?.stop();
    engineRef.current = null;
  };

  const copyShare = async (): Promise<void> => {
    if (!id) return;
    const url = `${window.location.origin}/episode/${id}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (typeof nav.share === 'function') {
        await nav.share({ title: data?.title ?? 'Hero Syndrome — episode', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* user cancelled or unsupported */ }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-paper px-6 py-16 text-ink">
        <p className="font-mono text-[11px] small-caps text-rust">Could not load episode: {error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <p className="font-mono text-[11px] small-caps text-ink/65">loading the episode…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/15">
        <div className="mx-auto max-w-3xl px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-10 md:pt-16">
          <p className="font-mono text-[10px] small-caps text-ink/55">Episode · {id}</p>
          <h1 className="display mt-4 font-serif text-[40px] leading-[1.05] tracking-tightest md:text-[64px]">
            {data.title}
          </h1>
          <p className="mt-3 font-mono text-[10px] small-caps text-ink/55">
            {new Date(data.startedAt).toLocaleString()} → {data.endedAt ? new Date(data.endedAt).toLocaleString() : '—'}
            {data.cosmic?.cosmicWord ? ` · cosmic word: ${data.cosmic.cosmicWord.word}` : ''}
            {` · quantum receipt: ${data.quantumReceipt.totalBytesConsumed} bytes / ${data.quantumReceipt.source}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <div className="flex items-center gap-4">
          {!playing ? (
            <button
              type="button"
              onClick={onPlay}
              className="group inline-flex items-baseline gap-3 border border-rust px-7 py-4 font-serif text-[20px] text-rust transition-colors duration-300 hover:bg-rust hover:text-paper"
            >
              Play episode
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="border border-ink/40 px-6 py-3 font-mono text-[11px] small-caps text-ink/85 transition hover:bg-ink/5"
            >
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={copyShare}
            className="border border-ink/40 px-6 py-3 font-mono text-[11px] small-caps text-ink/85 transition hover:bg-ink/5"
          >
            Send / copy link
          </button>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-[22px] tracking-tight">Timeline</h2>
          <ol className="mt-4 space-y-3">
            {data.songs.map((song, i) => (
              <li
                key={song.songId}
                className={`flex flex-wrap items-baseline gap-3 border-l-4 py-2 pl-4 transition-colors ${currentIdx === i ? 'border-rust bg-paper-deep/40' : 'border-ink/15'}`}
              >
                <span className="font-mono text-[10px] small-caps text-ink/55">
                  {i + 1}.
                </span>
                <span className="font-serif italic text-[15px] text-ink/85">
                  {song.metadata.transitionIntent}
                </span>
                <span className="font-serif text-[15px] text-ink">{song.metadata.key}</span>
                <span className="font-mono text-[11px] text-ink/65">
                  {song.metadata.bpmRange[0]}–{song.metadata.bpmRange[1]} bpm
                </span>
                <span className="font-mono text-[10px] small-caps text-ink/55">
                  {song.stateVector.time.phase} · {song.stateVector.location?.placeType ?? '—'} · {song.stateVector.weather?.condition ?? '—'}
                </span>
                <div className="basis-full font-serif italic text-[14px] text-ink/70">
                  {song.metadata.instrumentation.join(', ')}
                </div>
                {song.phraseOfTheMoment ? (
                  <div className="basis-full font-serif italic text-[13px] text-ink/60">
                    phrase: {song.phraseOfTheMoment.phrase}
                  </div>
                ) : null}
                {song.stickers.length > 0 ? (
                  <div className="basis-full font-mono text-[12px] text-ink/65">
                    stickers: {song.stickers.map((s) => s.emoji).join(' ')}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <SourcesFootnotes />
      </main>
    </div>
  );
}
