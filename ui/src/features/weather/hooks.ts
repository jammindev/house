import { useQuery } from '@tanstack/react-query';

import { fetchWeather } from '@/lib/api/weather';

// ── Query key factory ─────────────────────────────────────────────────────────

export const weatherKeys = {
  all: ['weather'] as const,
  forecast: () => [...weatherKeys.all, 'forecast'] as const,
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
