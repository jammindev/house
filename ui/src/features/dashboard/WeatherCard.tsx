import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Card, CardTitle } from '@/design-system/card';
import { conditionEmoji } from '@/features/weather/conditionEmoji';
import { ConditionIcon } from '@/features/weather/conditions';
import { useWeather } from '@/features/weather/hooks';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

/**
 * Dashboard weather widget — current temperature + condition + today's range.
 * Hides itself when the household has no location set or the fetch fails, so it
 * never shows a broken card. Full forecast lives on /app/weather.
 */
export default function WeatherCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data, isLoading } = useWeather();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;
  // Nothing to show: no location configured, upstream error, or empty payload.
  if (!data || !data.configured || data.error || !data.current) return null;

  const { current } = data;
  const today = data.daily?.[0];

  return (
    <Link to="/app/weather" state={pushBack(location)} className="group block h-full">
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          {conditionEmoji(current.condition, current.is_day)} {t('weather.title')}
        </CardTitle>
        <div className="mt-2 flex items-center gap-2">
          <ConditionIcon
            condition={current.condition}
            isDay={current.is_day}
            className="h-8 w-8 shrink-0 text-primary"
          />
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {current.temperature !== null ? `${Math.round(current.temperature)}°` : '—'}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {t(`weather.condition.${current.condition}`)}
        </p>
        {today && (
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {today.temp_min !== null ? `${Math.round(today.temp_min)}°` : '—'} /{' '}
            {today.temp_max !== null ? `${Math.round(today.temp_max)}°` : '—'}
            {data.location_label ? ` · ${data.location_label}` : ''}
          </p>
        )}
      </Card>
    </Link>
  );
}
