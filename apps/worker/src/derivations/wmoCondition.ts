import type { WeatherCondition } from '@hero-syndrome/shared';

export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'mainly-clear';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code === 51 || code === 53 || code === 55) return 'drizzle';
  if (code === 56 || code === 57) return 'freezing-drizzle';
  if (code === 61 || code === 63 || code === 65) return 'rain';
  if (code === 66 || code === 67) return 'freezing-rain';
  if (code === 71 || code === 73 || code === 75) return 'snow';
  if (code === 77) return 'snow-grains';
  if (code === 80 || code === 81 || code === 82) return 'rain-showers';
  if (code === 85 || code === 86) return 'snow-showers';
  if (code === 95) return 'thunderstorm';
  if (code === 96 || code === 99) return 'thunderstorm-hail';
  return 'mainly-clear';
}
