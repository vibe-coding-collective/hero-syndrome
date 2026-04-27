import type { GenerateReq } from '@hero-syndrome/shared';
import { api, songStreamUrl } from '../api/client';
import { recentHistory, useStore, type PlayedSong } from './store';
import type { AudioEngine } from '../audio/engine';

export class SongSynthesizer {
  private engine: AudioEngine;
  private inflight = false;
  private generationStartTimes = new Map<string, number>();
  private latencyEMA = 60_000;
  private alpha = 0.4;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  recordLatency(ms: number): void {
    this.latencyEMA = this.alpha * ms + (1 - this.alpha) * this.latencyEMA;
    useStore.getState().setPlayback({ generationLatencyEMA: this.latencyEMA });
    this.engine.setLeadSec(Math.ceil(this.latencyEMA / 1000) + 30);
  }

  async generateNext(): Promise<void> {
    if (this.inflight) return;
    const state = useStore.getState();
    if (!state.sessionId || !state.stateVector) return;
    this.inflight = true;
    const startTs = performance.now();
    const requestId = String(Date.now());
    this.generationStartTimes.set(requestId, startTs);
    const body: GenerateReq = {
      sessionId: state.sessionId,
      stateVector: state.stateVector,
      stickers: state.stickers,
      recentHistory: recentHistory(state.songs),
    };
    try {
      const res = await api.generate(body);
      const latency = performance.now() - startTs;
      this.recordLatency(latency);
      const url = songStreamUrl(state.sessionId, res.songId);
      const played: PlayedSong = {
        songId: res.songId,
        songUrl: url,
        metadata: res.metadata,
        composition: res.composition,
        durationSec: res.durationSec,
        source: 'generated',
      };
      useStore.getState().appendSong(played);
      try {
        await this.engine.enqueue(url, res.songId);
      } catch (err) {
        console.error('enqueue failed', err);
      }
    } catch (err) {
      console.error('generate failed', err);
    } finally {
      this.inflight = false;
      this.generationStartTimes.delete(requestId);
    }
  }
}
