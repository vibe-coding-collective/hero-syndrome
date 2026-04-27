import type { TimePhase, DayOfWeek } from '@hero-syndrome/shared';

const DAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function timePhaseFromHour(hour: number): TimePhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 19) return 'goldenHour';
  if (hour >= 19 && hour < 21) return 'dusk';
  if (hour >= 21 || hour < 2) return 'night';
  return 'witchingHour';
}

export interface ClockReading {
  hour: number;
  phase: TimePhase;
  dayOfWeek: DayOfWeek;
  timestamp: string;
}

export function readClock(now: Date = new Date()): ClockReading {
  const hour = now.getHours();
  return {
    hour,
    phase: timePhaseFromHour(hour),
    dayOfWeek: DAYS[now.getDay()] ?? 'Mon',
    timestamp: now.toISOString(),
  };
}
