import type { MotionClass, MovementPattern } from '@hero-syndrome/shared';

const WINDOW_MS = 4000;
const SAMPLE_HZ = 10;
const STILL_INTENSITY = 0.05;
const VEHICLE_GPS_THRESHOLD_MPS = 7;
const VEHICLE_DURATION_MS = 10000;

export interface MotionReading {
  intensityNormalized: number;
  motionClass: MotionClass;
  pattern: MovementPattern;
}

interface Sample {
  ts: number;
  magnitude: number;
}

function variance(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const mean = samples.reduce((acc, s) => acc + s.magnitude, 0) / samples.length;
  let sum = 0;
  for (const s of samples) sum += (s.magnitude - mean) ** 2;
  return sum / samples.length;
}

function autocorrPeak(samples: Sample[], minLagS: number, maxLagS: number): { peak: number; lag: number } {
  if (samples.length < 8) return { peak: 0, lag: 0 };
  const n = samples.length;
  const mean = samples.reduce((acc, s) => acc + s.magnitude, 0) / n;
  const centered = samples.map((s) => s.magnitude - mean);
  const dt = (samples[n - 1]!.ts - samples[0]!.ts) / (n - 1) / 1000;
  if (dt <= 0) return { peak: 0, lag: 0 };
  const minLag = Math.max(1, Math.floor(minLagS / dt));
  const maxLag = Math.min(n - 1, Math.ceil(maxLagS / dt));
  let bestPeak = 0;
  let bestLag = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += centered[i]! * centered[i]!;
  if (denom === 0) return { peak: 0, lag: 0 };
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < n - lag; i++) num += centered[i]! * centered[i + lag]!;
    const r = num / denom;
    if (r > bestPeak) {
      bestPeak = r;
      bestLag = lag * dt;
    }
  }
  return { peak: bestPeak, lag: bestLag };
}

function classify(samples: Sample[], gpsSpeedMps: number, gpsHighSinceMs: number, intensity: number): MotionClass {
  if (gpsSpeedMps > VEHICLE_GPS_THRESHOLD_MPS && gpsHighSinceMs >= VEHICLE_DURATION_MS) return 'vehicle';
  const ac = autocorrPeak(samples, 0.25, 0.7);
  if (ac.peak > 0.5 && ac.lag >= 0.25 && ac.lag <= 0.4 && intensity > 0.3) return 'running';
  if (ac.peak > 0.45 && ac.lag >= 0.4 && ac.lag <= 0.7 && intensity >= 0.05 && intensity <= 0.3) return 'walking';
  if (intensity < STILL_INTENSITY) return 'still';
  return 'still';
}

function classifyPattern(samples: Sample[]): MovementPattern {
  const v = variance(samples);
  if (v < 0.02) return 'still';
  const ac = autocorrPeak(samples, 0.3, 1.0);
  if (v >= 0.02 && ac.peak > 0.6) return 'rhythmic';
  if (v >= 0.02 && ac.peak <= 0.6) return 'erratic';
  return 'steady';
}

export class MotionSensor {
  private samples: Sample[] = [];
  private gpsSpeedMps = 0;
  private gpsHighSinceMs = 0;
  private lastClass: MotionClass = 'still';
  private lastPattern: MovementPattern = 'still';
  private pendingClass: MotionClass | null = null;
  private pendingPattern: MovementPattern | null = null;
  private listener: ((event: DeviceMotionEvent) => void) | null = null;
  private running = false;

  async requestPermission(): Promise<boolean> {
    const dme: any = (window as any).DeviceMotionEvent;
    if (dme && typeof dme.requestPermission === 'function') {
      try {
        const r = await dme.requestPermission();
        return r === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.listener = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity ?? event.acceleration ?? null;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const gravityNormed = Math.abs(mag - 9.81) / 9.81;
      this.samples.push({ ts: Date.now(), magnitude: gravityNormed });
      const cutoff = Date.now() - WINDOW_MS;
      while (this.samples.length > 0 && this.samples[0]!.ts < cutoff) this.samples.shift();
    };
    window.addEventListener('devicemotion', this.listener);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.listener) window.removeEventListener('devicemotion', this.listener);
    this.listener = null;
  }

  setGpsSpeed(speedMps: number): void {
    const now = Date.now();
    if (speedMps > VEHICLE_GPS_THRESHOLD_MPS) {
      if (this.gpsSpeedMps <= VEHICLE_GPS_THRESHOLD_MPS) this.gpsHighSinceMs = now;
    } else {
      this.gpsHighSinceMs = 0;
    }
    this.gpsSpeedMps = speedMps;
  }

  read(): MotionReading {
    const samples = this.samples;
    const intensity = Math.min(1, samples.length === 0 ? 0 : samples.reduce((a, s) => a + s.magnitude, 0) / samples.length / 0.4);
    const gpsHighDuration = this.gpsHighSinceMs > 0 ? Date.now() - this.gpsHighSinceMs : 0;
    const candidate = classify(samples, this.gpsSpeedMps, gpsHighDuration, intensity);
    const candidatePattern = classifyPattern(samples);

    let motionClass: MotionClass;
    if (candidate === this.lastClass) {
      motionClass = this.lastClass;
      this.pendingClass = null;
    } else if (this.pendingClass === candidate) {
      motionClass = candidate;
      this.lastClass = candidate;
      this.pendingClass = null;
    } else {
      motionClass = this.lastClass;
      this.pendingClass = candidate;
    }

    let pattern: MovementPattern;
    if (candidatePattern === this.lastPattern) {
      pattern = this.lastPattern;
      this.pendingPattern = null;
    } else if (this.pendingPattern === candidatePattern) {
      pattern = candidatePattern;
      this.lastPattern = candidatePattern;
      this.pendingPattern = null;
    } else {
      pattern = this.lastPattern;
      this.pendingPattern = candidatePattern;
    }

    return { intensityNormalized: Math.max(0, Math.min(1, intensity)), motionClass, pattern };
  }
}

export const SAMPLE_INTERVAL_MS = Math.round(1000 / SAMPLE_HZ);
