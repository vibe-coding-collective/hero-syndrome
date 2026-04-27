import { create } from 'zustand';
import type {
  CosmicSnapshot,
  MeasuredFeatures,
  SongMetadata,
  StateVector,
  Sticker,
  Composition,
} from '@hero-syndrome/shared';

export interface PlayedSong {
  songId: string;
  songUrl: string;
  metadata: SongMetadata;
  composition: Composition;
  durationSec: number;
  startedAt?: number;
  measuredFeatures?: MeasuredFeatures;
  source: 'prelude' | 'generated';
}

export interface SessionSlice {
  sessionId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  cosmic: CosmicSnapshot | null;
  songs: PlayedSong[];
  stickers: Sticker[];
  stickerEvents: Array<{ emoji: string; placedAt: string }>;
}

export interface PlaybackSlice {
  isPlaying: boolean;
  currentSongId: string | null;
  generationLatencyEMA: number;
}

export interface SensorsSlice {
  stateVector: StateVector | null;
  permissionsGranted: { motion: boolean; geolocation: boolean };
}

export interface EpisodeSlice {
  episodeId: string | null;
  title: string | null;
  shareUrl: string | null;
}

export interface AppState extends SessionSlice, PlaybackSlice, SensorsSlice, EpisodeSlice {
  setSession: (s: Partial<SessionSlice>) => void;
  setPlayback: (s: Partial<PlaybackSlice>) => void;
  setSensors: (s: Partial<SensorsSlice>) => void;
  setEpisode: (s: Partial<EpisodeSlice>) => void;
  setStateVector: (sv: StateVector) => void;
  appendSong: (s: PlayedSong) => void;
  setSongMeasured: (songId: string, features: MeasuredFeatures) => void;
  setSongStarted: (songId: string, startedAt: number) => void;
  addSticker: (sticker: Sticker) => void;
  pruneStickers: (now: number) => void;
  resetSession: () => void;
}

const INITIAL_STATE: SessionSlice & PlaybackSlice & SensorsSlice & EpisodeSlice = {
  sessionId: null,
  startedAt: null,
  endedAt: null,
  cosmic: null,
  songs: [],
  stickers: [],
  stickerEvents: [],
  isPlaying: false,
  currentSongId: null,
  generationLatencyEMA: 60_000,
  stateVector: null,
  permissionsGranted: { motion: false, geolocation: false },
  episodeId: null,
  title: null,
  shareUrl: null,
};

export const useStore = create<AppState>((set) => ({
  ...INITIAL_STATE,
  setSession: (s) => set((p) => ({ ...p, ...s })),
  setPlayback: (s) => set((p) => ({ ...p, ...s })),
  setSensors: (s) => set((p) => ({ ...p, ...s })),
  setEpisode: (s) => set((p) => ({ ...p, ...s })),
  setStateVector: (sv) => set({ stateVector: sv }),
  appendSong: (song) =>
    set((p) => ({
      songs: [...p.songs, song],
    })),
  setSongMeasured: (songId, features) =>
    set((p) => ({
      songs: p.songs.map((s) => (s.songId === songId ? { ...s, measuredFeatures: features } : s)),
    })),
  setSongStarted: (songId, startedAt) =>
    set((p) => ({
      songs: p.songs.map((s) => (s.songId === songId ? { ...s, startedAt } : s)),
    })),
  addSticker: (sticker) =>
    set((p) => ({
      stickers: [...p.stickers, sticker],
      stickerEvents: [...p.stickerEvents, { emoji: sticker.emoji, placedAt: sticker.placedAt }],
    })),
  pruneStickers: (now) =>
    set((p) => ({
      stickers: p.stickers.filter((s) => new Date(s.decayAt).getTime() > now),
    })),
  resetSession: () => set({ ...INITIAL_STATE }),
}));

export function recentHistory(songs: PlayedSong[]): Array<{
  songId: string;
  metadata: SongMetadata;
  measuredFeatures?: MeasuredFeatures;
}> {
  return songs.slice(-3).map((s) => ({
    songId: s.songId,
    metadata: s.metadata,
    ...(s.measuredFeatures ? { measuredFeatures: s.measuredFeatures } : {}),
  }));
}
