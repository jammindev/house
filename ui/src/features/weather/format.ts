import type { Weather, WeatherCondition } from '@/lib/api/weather';

/**
 * La température, dite d'une seule façon.
 *
 * Le header et la page météo lisent la même donnée : deux arrondis distincts
 * afficheraient 12° en haut et 13° dans la page, et le foyer n'aurait aucun
 * moyen de savoir lequel croire.
 */
export function fmtTemp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)}°`;
}

export interface HeaderWeather {
  temp: string;
  condition: WeatherCondition;
  isDay: boolean;
  label: string;
}

/**
 * Ce que le header a le droit d'afficher — ou `null`.
 *
 * `null` couvre quatre cas qui se ressemblent à l'écran mais pas dans la
 * donnée : module désactivé, ville jamais renseignée, fournisseur injoignable,
 * température inconnue. Les trois derniers sont exactement les moments où il
 * faut pouvoir **atteindre** la page météo — d'où l'entrée de sidebar qui
 * subsiste tant que cette fonction renvoie `null`.
 */
export function headerWeatherFrom(
  data: Weather | undefined,
  moduleActive: boolean,
): HeaderWeather | null {
  if (!moduleActive || !data?.configured || data.error) return null;

  const current = data.current;
  if (current?.temperature === null || current?.temperature === undefined) return null;

  return {
    temp: fmtTemp(current.temperature),
    condition: current.condition,
    isDay: current.is_day,
    label: data.location_label ?? '',
  };
}
