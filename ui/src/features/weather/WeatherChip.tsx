import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ConditionIcon } from './conditions';
import { useHeaderWeather } from './hooks';

/** La température du foyer dans le header — et le chemin vers la page météo. */
export default function WeatherChip() {
  const { t } = useTranslation();
  const weather = useHeaderWeather();

  if (!weather) return null;

  return (
    <Link
      to="/app/weather"
      title={weather.label || t('weather.title')}
      aria-label={`${t('weather.title')} — ${weather.temp}`}
      data-testid="header-weather"
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ConditionIcon condition={weather.condition} isDay={weather.isDay} className="h-4 w-4" />
      <span className="text-sm font-medium tabular-nums">{weather.temp}</span>
      {/* Le lieu n'apparaît qu'au large : sur mobile il mangerait le nom du foyer. */}
      {weather.label ? (
        <span className="hidden max-w-28 truncate text-xs text-muted-foreground xl:inline">
          {weather.label}
        </span>
      ) : null}
    </Link>
  );
}
