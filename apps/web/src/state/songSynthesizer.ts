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
  private watchdog: number | null = null;
  private destroyed = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.watchdog = window.setInterval(() => this.watchdogTick(), 5000);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.watchdog != null) window.clearInterval(this.watchdog);
  }

  private watchdogTick(): void {
    if (this.destroyed || this.inflight) return;
    const state = useStore.getState();
    if (!state.sessionId) return;
    // If the engine has nothing playing and nothing queued, we should be
    // generating the next song. The audio engine's own onNeedNext only fires
    // while a song is playing, so this watchdog covers the gap.
    if (!this.engine.currentSongId() && !this.engine.hasNext()) {
      this.generateNext().catch(() => undefined);
    }
  }

  recordLatency(ms: number): void {
    this.latencyEMA = this.alpha * ms + (1 - this.alpha) * this.latencyEMA;
    useStore.getState().setPlayback({ generationLatencyEMA: this.latencyEMA });
    this.engine.setLeadSec(Math.ceil(this.latencyEMA / 1000) + 30);
  }

  async generateNext(): Promise<void> {
    if (this.inflight) return;
    const state = useStore.getState();
    if (!state.sessionId) return;
    if (!state.stateVector) {
      // State aggregator hasn't ticked yet. Try again shortly; the watchdog
      // will also catch it if this window is short.
      window.setTimeout(() => this.generateNext().catch(() => undefined), 500);
      return;
    }
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
      console.log('[synth] /generate request →', body.sessionId);
      const res = await api.generate(body);
      const latency = performance.now() - startTs;
      this.recordLatency(latency);
      console.log('[synth] /generate response ←', res.songId, `${(latency / 1000).toFixed(1)}s`);
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
        console.log('[synth] enqueue', url);
        await this.engine.enqueue(url, res.songId);
        console.log('[synth] enqueue ok');
      } catch (err) {
        console.error('[synth] enqueue failed', err);
      }
    } catch (err) {
      console.error('[synth] generate failed', err);
    } finally {
      this.inflight = false;
      this.generationStartTimes.delete(requestId);
    }
  }
}
