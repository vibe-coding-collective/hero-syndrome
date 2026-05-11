import type { WeatherCondition } from '@hero-syndrome/shared';

/** Normalize a weather condition string. Accepts both hyphenated legacy form
 *  ("mainly-clear") and snake_case canonical form ("mainly_clear"). */
export function normalizeWeatherCondition(raw: string): WeatherCondition {
  return raw.replace(/-/g, '_') as WeatherCondition;
}

/** Normalize a mood tag for lexicon lookup. Hyphenated → underscore. */
export function normalizeMoodTag(tag: string): string {
  return tag.replace(/-/g, '_');
}
