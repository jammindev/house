import { useQuery } from '@tanstack/react-query';

import { fetchWeather, fetchWeatherHistory } from '@/lib/api/weather';
import { useDisabledModules } from '@/lib/modules';

import { headerWeatherFrom, type HeaderWeather } from './format';

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
export function useWeather(enabled = true) {
  return useQuery({
    queryKey: weatherKeys.forecast(),
    queryFn: fetchWeather,
    staleTime: 30 * 60 * 1000,
    enabled,
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

/** Le chip du header, branché sur le module et sur la donnée (voir `format.ts`). */
export function useHeaderWeather(): HeaderWeather | null {
  const { disabled, isLoading: modulesLoading } = useDisabledModules();
  const active = !modulesLoading && !disabled.has('weather');
  const { data } = useWeather(active);
  return headerWeatherFrom(data, active);
}
