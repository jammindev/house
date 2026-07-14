import type { WeatherCondition } from '@/lib/api/weather';

/** Emoji shown in CardTitle-style contexts (immune to hover styles). */
const EMOJI: Record<WeatherCondition, string> = {
  clear: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  unknown: '🌡️',
};

export function conditionEmoji(condition: WeatherCondition, isDay = true): string {
  if (condition === 'clear' && !isDay) return '🌙';
  return EMOJI[condition] ?? EMOJI.unknown;
}
