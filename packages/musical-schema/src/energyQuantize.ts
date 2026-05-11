import type { EnergyAxes } from './types';

export type MotionBucket = 'very_low' | 'low' | 'mid' | 'high' | 'very_high';
export type DensityBucket = 'sparse' | 'moderate' | 'dense';
export type TensionBucket = 'calm' | 'moderate' | 'high';
export type BrightnessBucket =
  | 'very_dark'
  | 'dark'
  | 'neutral'
  | 'bright'
  | 'very_bright';

export function quantizeMotion(m: number): MotionBucket {
  if (m < 0.2) return 'very_low';
  if (m < 0.35) return 'low';
  if (m < 0.55) return 'mid';
  if (m < 0.75) return 'high';
  return 'very_high';
}

export function quantizeDensity(d: number): DensityBucket {
  if (d < 0.35) return 'sparse';
  if (d < 0.62) return 'moderate';
  return 'dense';
}

export function quantizeTension(t: number): TensionBucket {
  if (t < 0.38) return 'calm';
  if (t < 0.62) return 'moderate';
  return 'high';
}

export function quantizeBrightness(b: number): BrightnessBucket {
  if (b < 0.18) return 'very_dark';
  if (b < 0.35) return 'dark';
  if (b < 0.55) return 'neutral';
  if (b < 0.72) return 'bright';
  return 'very_bright';
}

export interface QuantizedEnergy {
  motion: MotionBucket;
  density: DensityBucket;
  tension: TensionBucket;
  brightness: BrightnessBucket;
}

export function quantizeEnergy(e: EnergyAxes): QuantizedEnergy {
  return {
    motion: quantizeMotion(e.motion),
    density: quantizeDensity(e.density),
    tension: quantizeTension(e.tension),
    brightness: quantizeBrightness(e.brightness),
  };
}
