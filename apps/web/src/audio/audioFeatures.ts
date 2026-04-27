import type { MeasuredFeatures } from '@hero-syndrome/shared';

const SAMPLE_INTERVAL_MS = 100;
const MIN_SAMPLES = 80; // ~8 s
const MAX_SAMPLES = 200; // ~20 s

interface RawSample {
  ts: number;
  rms: number;
  centroidHz: number;
}

export class AudioFeatureExtractor {
  private analyser: AnalyserNode;
  private timeBuf: Uint8Array<ArrayBuffer>;
  private freqBuf: Uint8Array<ArrayBuffer>;
  private samples: RawSample[] = [];
  private timer: number | null = null;
  private lastDurationSec = 0;

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.timeBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    this.freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  }

  begin(durationSec: number): void {
    this.samples = [];
    this.lastDurationSec = durationSec;
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.collect(), SAMPLE_INTERVAL_MS);
  }

  finish(): void {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private collect(): void {
    this.analyser.getByteTimeDomainData(this.timeBuf);
    let sumSquares = 0;
    for (let i = 0; i < this.timeBuf.length; i++) {
      const v = (this.timeBuf[i]! - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / this.timeBuf.length);

    this.analyser.getByteFrequencyData(this.freqBuf);
    let weighted = 0;
    let total = 0;
    const sampleRate = (this.analyser.context as AudioContext).sampleRate;
    const binHz = sampleRate / 2 / this.freqBuf.length;
    for (let i = 0; i < this.freqBuf.length; i++) {
      const m = this.freqBuf[i]!;
      weighted += m * (i + 0.5) * binHz;
      total += m;
    }
    const centroidHz = total > 0 ? weighted / total : 0;

    this.samples.push({ ts: performance.now(), rms, centroidHz });
    if (this.samples.length > MAX_SAMPLES) this.samples = this.samples.slice(-MAX_SAMPLES);
  }

  ready(): boolean {
    return this.samples.length >= MIN_SAMPLES;
  }

  estimate(): MeasuredFeatures | null {
    if (!this.ready()) return null;
    const rmsSamples = this.samples.map((s) => s.rms);
    const centroids = this.samples.map((s) => s.centroidHz);
    const meanRms = rmsSamples.reduce((a, b) => a + b, 0) / rmsSamples.length;
    const meanCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length;
    const bpm = estimateBpm(rmsSamples, SAMPLE_INTERVAL_MS / 1000);
    return {
      bpmEstimate: bpm,
      spectralCentroidHz: meanCentroid,
      rmsLoudness: Math.min(1, meanRms * 2),
      durationSec: this.lastDurationSec,
    };
  }
}

function estimateBpm(rms: number[], dt: number): number {
  // Onset envelope: half-wave rectified differential of RMS
  const onset: number[] = new Array(rms.length).fill(0);
  for (let i = 1; i < rms.length; i++) {
    const diff = rms[i]! - rms[i - 1]!;
    onset[i] = diff > 0 ? diff : 0;
  }
  const mean = onset.reduce((a, b) => a + b, 0) / onset.length;
  const centered = onset.map((v) => v - mean);
  let denom = 0;
  for (let i = 0; i < centered.length; i++) denom += centered[i]! * centered[i]!;
  if (denom === 0) return 90;
  // Try lags from 60 BPM (1 s) to 180 BPM (0.333 s)
  const minLag = Math.max(1, Math.round(0.333 / dt));
  const maxLag = Math.min(centered.length - 1, Math.round(1.0 / dt));
  let bestPeak = 0;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < centered.length - lag; i++) num += centered[i]! * centered[i + lag]!;
    const r = num / denom;
    if (r > bestPeak) {
      bestPeak = r;
      bestLag = lag;
    }
  }
  const periodSec = bestLag * dt;
  return Math.max(40, Math.min(200, 60 / periodSec));
}
