import type { MoonPhase } from '@hero-syndrome/shared';

const SYNODIC_DAYS = 29.530588853;
// Reference new moon: 2000-01-06 18:14 UTC (Julian day 2451550.1).
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Continuous lunar age in days since the reference new moon. */
function lunarAgeDays(date: Date): number {
  const elapsedDays = (date.getTime() - REF_NEW_MOON_MS) / 86400000;
  const age = elapsedDays % SYNODIC_DAYS;
  return age < 0 ? age + SYNODIC_DAYS : age;
}

/** Bucket continuous lunar age into Jeremy's 8 named phases.
 *  Bucket widths roughly match traditional phase boundaries. */
export function moonPhaseForDate(date: Date = new Date()): MoonPhase {
  const age = lunarAgeDays(date);
  const phase = age / SYNODIC_DAYS; // 0..1
  if (phase < 0.0625) return 'new';
  if (phase < 0.1875) return 'waxing_crescent';
  if (phase < 0.3125) return 'first_quarter';
  if (phase < 0.4375) return 'waxing_gibbous';
  if (phase < 0.5625) return 'full';
  if (phase < 0.6875) return 'waning_gibbous';
  if (phase < 0.8125) return 'third_quarter';
  if (phase < 0.9375) return 'waning_crescent';
  return 'new';
}
