import type { CosmicSnapshot, StateVector, Sticker } from './state';
import type {
  Composition,
  MeasuredFeatures,
  PhraseOfTheMoment,
  QuantumBytes,
  SongMetadata,
} from './song';
import type { MusicalPicks } from './musicalPicks';

export interface SongRecord {
  songId: string;
  startedAt: string;
  durationSec: number;
  metadata: SongMetadata;
  composition: Composition;
  measuredFeatures?: MeasuredFeatures;
  stateVector: StateVector;
  stickers: Sticker[];
  quantumBytes: QuantumBytes;
  phraseOfTheMoment?: PhraseOfTheMoment;
  musicalPicks?: MusicalPicks;
}

export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  cosmic?: CosmicSnapshot;
  songs: SongRecord[];
  stickerEvents: Array<{ emoji: string; placedAt: string }>;
}

export interface QuantumReceipt {
  totalBytesConsumed: number;
  source: 'qrng' | 'mixed' | 'pseudo';
}

export interface EpisodeRecord extends SessionRecord {
  episodeId: string;
  title: string;
  quantumReceipt: QuantumReceipt;
}
