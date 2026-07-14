import { api } from '@/lib/axios';

/**
 * Weather module API client (parcours 17).
 *
 * Read-only: no CRUD. The backend proxies Open-Meteo for the current
 * household's stored location and exposes a geocoding search used by settings.
 */

/** Stable condition slug returned by the backend (WMO code → slug). */
export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

export interface WeatherCurrent {
  time: string | null;
  temperature: number | null;
  apparent_temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  weather_code: number | null;
  condition: WeatherCondition;
  is_day: boolean;
}

export interface WeatherHour {
  time: string;
  temperature: number | null;
  precipitation_probability: number | null;
  weather_code: number | null;
  condition: WeatherCondition;
}

export interface WeatherDay {
  date: string;
  weather_code: number | null;
  condition: WeatherCondition;
  temp_max: number | null;
  temp_min: number | null;
  precipitation_probability_max: number | null;
  wind_gusts_max: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface WeatherUnits {
  temperature: string;
  wind_speed: string;
}

/**
 * Weather payload. `configured=false` when the household has no location yet;
 * `error=true` when Open-Meteo was unreachable. Both are HTTP 200.
 */
export interface Weather {
  configured: boolean;
  error?: boolean;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  timezone?: string;
  units?: WeatherUnits;
  current?: WeatherCurrent;
  hourly?: WeatherHour[];
  daily?: WeatherDay[];
}

export interface GeocodeResult {
  name: string;
  admin1: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
}

export async function fetchWeather(): Promise<Weather> {
  const { data } = await api.get('/weather/');
  return data as Weather;
}

export async function geocodePlace(q: string): Promise<GeocodeResult[]> {
  const { data } = await api.get('/weather/geocode/', { params: { q } });
  return (data as { results?: GeocodeResult[] }).results ?? [];
}

// ── History (Lot 6 — consumption overlay) ────────────────────────────────────

export interface WeatherHistoryPoint {
  date: string; // YYYY-MM-DD
  temp_mean: number;
}

export interface WeatherHistory {
  configured: boolean;
  error?: boolean;
  points: WeatherHistoryPoint[];
}

export async function fetchWeatherHistory(params: {
  date_from: string;
  date_to: string;
}): Promise<WeatherHistory> {
  const { data } = await api.get('/weather/history/', { params });
  return data as WeatherHistory;
}
