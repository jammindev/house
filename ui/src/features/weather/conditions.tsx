import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';

import type { WeatherCondition } from '@/lib/api/weather';

/**
 * Renders the lucide icon for a weather condition. Each branch returns a
 * literal JSX element with a statically-known component — required by the
 * `react-hooks/static-components` rule (a component may not be derived from a
 * lookup and then rendered during render).
 */
export function ConditionIcon({
  condition,
  isDay = true,
  className,
}: {
  condition: WeatherCondition;
  isDay?: boolean;
  className?: string;
}) {
  switch (condition) {
    case 'clear':
      return isDay ? (
        <Sun className={className} aria-hidden />
      ) : (
        <Moon className={className} aria-hidden />
      );
    case 'partly_cloudy':
      return <CloudSun className={className} aria-hidden />;
    case 'cloudy':
      return <Cloud className={className} aria-hidden />;
    case 'fog':
      return <CloudFog className={className} aria-hidden />;
    case 'drizzle':
      return <CloudDrizzle className={className} aria-hidden />;
    case 'rain':
      return <CloudRain className={className} aria-hidden />;
    case 'snow':
      return <CloudSnow className={className} aria-hidden />;
    case 'thunderstorm':
      return <CloudLightning className={className} aria-hidden />;
    default:
      return <Cloud className={className} aria-hidden />;
  }
}
