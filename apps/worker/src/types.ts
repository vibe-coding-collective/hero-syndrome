import type {
  CosmicSnapshot,
  EpisodeRecord,
  SessionRecord,
} from '@hero-syndrome/shared';

export interface Env {
  AUDIO: R2Bucket;
  EPISODES: KVNamespace;
  AI: Ai;
  SESSION_DO: DurableObjectNamespace;
  QUANTUM_DO: DurableObjectNamespace;

  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  USER_AGENT: string;
  CORS_ORIGINS: string;
  DEV_TOKEN: string;
}

export type EpisodeKvRecord = EpisodeRecord;
export type SessionKvCachePayload<T> = { value: T; expiresAtMs: number };

export interface DebugLogEvent {
  ts: string;
  event: string;
  payload?: unknown;
}

export interface SessionDoState extends SessionRecord {
  lastGenerateTs?: number;
  finalized: boolean;
  debugLog: DebugLogEvent[];
}

export interface CosmicCachedAggregate {
  cachedAt: string;
  cosmic: CosmicSnapshot;
}
