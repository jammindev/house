import type { WeatherDay } from '@/lib/api/weather';

/**
 * Threshold (max precipitation probability, %) under which a day counts as
 * "dry" / favorable for an outdoor task. V1 rule kept deliberately simple —
 * precipitation only, no wind. Tunable in one place.
 */
export const DRY_DAY_MAX_PRECIP = 30;

/**
 * From a daily forecast, return the days favorable for a "dry weather" task:
 * precipitation probability at or below {@link DRY_DAY_MAX_PRECIP}. Days with an
 * unknown probability are treated as favorable (no evidence of rain). Order is
 * preserved (soonest first).
 */
export function favorableDays(
  daily: WeatherDay[] | undefined,
  maxPrecip: number = DRY_DAY_MAX_PRECIP,
): WeatherDay[] {
  if (!daily) return [];
  return daily.filter((d) => {
    const p = d.precipitation_probability_max;
    return p === null || p === undefined || p <= maxPrecip;
  });
}
