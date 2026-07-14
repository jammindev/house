import { MapPin, Droplets, Wind, Sunrise, Sunset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { WeatherCondition, WeatherDay, WeatherHour } from '@/lib/api/weather';

import { ConditionIcon } from './conditions';
import { useWeather } from './hooks';

function fmtTemp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)}°`;
}

function conditionLabel(t: (k: string) => string, condition: WeatherCondition): string {
  return t(`weather.condition.${condition}`);
}

export default function WeatherPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data, isLoading, isError } = useWeather();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // Not configured → invite to set the household location (settings).
  if (data && !data.configured) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('weather.title')} description={t('weather.description')} />
        <EmptyState
          icon={MapPin}
          title={t('weather.notConfigured.title')}
          description={t('weather.notConfigured.description')}
          action={{ label: t('weather.notConfigured.cta'), href: '/app/settings' }}
        />
      </div>
    );
  }

  const errored = isError || data?.error;
  const current = data?.current;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('weather.title')}
        description={data?.location_label || t('weather.description')}
      >
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <MapPin className="h-4 w-4" />
          {t('weather.changeLocation')}
        </Link>
      </PageHeader>

      {errored ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('weather.error')}</p>
        </Card>
      ) : (
        <>
          {/* Current conditions */}
          {current && (
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <ConditionIcon
                  condition={current.condition}
                  isDay={current.is_day}
                  className="h-14 w-14 shrink-0 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-4xl font-semibold tracking-tight text-foreground">
                    {fmtTemp(current.temperature)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {conditionLabel(t, current.condition)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t('weather.feelsLike')} {fmtTemp(current.apparent_temperature)}
                </span>
                {current.humidity !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-4 w-4" /> {Math.round(current.humidity)}%
                  </span>
                )}
                {current.wind_speed !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Wind className="h-4 w-4" /> {Math.round(current.wind_speed)}{' '}
                    {data?.units?.wind_speed ?? 'km/h'}
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Today, hourly */}
          {data?.hourly && data.hourly.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-medium text-foreground">{t('weather.today')}</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {data.hourly.map((hour) => (
                  <HourCell key={hour.time} hour={hour} locale={locale} />
                ))}
              </div>
            </Card>
          )}

          {/* 7-day forecast */}
          {data?.daily && data.daily.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-medium text-foreground">
                {t('weather.forecast7d')}
              </h2>
              <div className="divide-y divide-border">
                {data.daily.map((day, index) => (
                  <DayRow key={day.date} day={day} locale={locale} isToday={index === 0} t={t} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function HourCell({ hour, locale }: { hour: WeatherHour; locale: string }) {
  const time = new Date(hour.time).toLocaleTimeString(locale, { hour: '2-digit' });
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 text-center">
      <span className="text-xs text-muted-foreground">{time}</span>
      <ConditionIcon condition={hour.condition} className="h-5 w-5 text-primary" />
      <span className="text-sm font-medium text-foreground">{fmtTemp(hour.temperature)}</span>
      {hour.precipitation_probability !== null && hour.precipitation_probability > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {hour.precipitation_probability}%
        </span>
      )}
    </div>
  );
}

function DayRow({
  day,
  locale,
  isToday,
  t,
}: {
  day: WeatherDay;
  locale: string;
  isToday: boolean;
  t: (k: string) => string;
}) {
  const label = isToday
    ? t('weather.dayToday')
    : new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long' });
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-24 shrink-0 text-sm capitalize text-foreground">{label}</span>
      <ConditionIcon condition={day.condition} className="h-5 w-5 shrink-0 text-primary" />
      {day.precipitation_probability_max !== null && day.precipitation_probability_max > 0 ? (
        <span className="inline-flex w-14 items-center gap-1 text-xs text-muted-foreground">
          <Droplets className="h-3.5 w-3.5" /> {day.precipitation_probability_max}%
        </span>
      ) : (
        <span className="w-14" />
      )}
      {day.sunrise && day.sunset && (
        <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
          <span className="inline-flex items-center gap-1">
            <Sunrise className="h-3.5 w-3.5" />
            {new Date(day.sunrise).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sunset className="h-3.5 w-3.5" />
            {new Date(day.sunset).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      )}
      <span className="ml-auto text-sm text-muted-foreground">{fmtTemp(day.temp_min)}</span>
      <span className="w-10 text-right text-sm font-medium text-foreground">
        {fmtTemp(day.temp_max)}
      </span>
    </div>
  );
}
