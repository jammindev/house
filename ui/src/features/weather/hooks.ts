import { useQuery } from '@tanstack/react-query';

import { fetchWeather, fetchWeatherHistory } from '@/lib/api/weather';

// ── Query key factory ─────────────────────────────────────────────────────────

export const weatherKeys = {
  all: ['weather'] as const,
  forecast: () => [...weatherKeys.all, 'forecast'] as const,
  history: (params: { date_from: string; date_to: string }) =>
    [...weatherKeys.all, 'history', params] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

/**
 * Current conditions + 7-day forecast for the active household's location.
 * Refetched every 30 min to match the backend cache TTL.
 */
export function useWeather() {
  return useQuery({
    queryKey: weatherKeys.forecast(),
    queryFn: fetchWeather,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Daily mean temperatures over a period (Lot 6 consumption overlay). Disabled
 * until ``enabled`` — the page only fetches when the weather overlay is toggled
 * on. Cached long (the past doesn't change).
 */
export function useWeatherHistory(
  params: { date_from: string; date_to: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: weatherKeys.history(params),
    queryFn: () => fetchWeatherHistory(params),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
