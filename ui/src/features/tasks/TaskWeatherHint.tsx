import { CloudSun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/design-system/card';
import type { Task } from '@/lib/api/tasks';
import { useDisabledModules } from '@/lib/modules';
import { ConditionIcon } from '@/features/weather/conditions';
import { favorableDays } from '@/features/weather/favorableDays';
import { useWeather } from '@/features/weather/hooks';

/**
 * On an outdoor "dry weather" task without a fixed due date, suggests the
 * favorable days from the 7-day forecast (parcours 17, Lot 3, US3.2).
 *
 * Renders nothing — silently — when the task isn't weather-sensitive, is done,
 * has a fixed due date, the weather module is disabled, or the household has no
 * location / the forecast is unavailable. It never blocks the task.
 */
export default function TaskWeatherHint({ task }: { task: Task }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { disabled } = useDisabledModules();
  const weatherEnabled = !disabled.has('weather');

  // Suggestion only makes sense for an unscheduled outdoor task still to do.
  const relevant = task.needs_dry_weather && task.status !== 'done' && !task.due_date;
  const { data } = useWeather();

  if (!weatherEnabled || !relevant) return null;
  if (!data || !data.configured || data.error || !data.daily) return null;

  const good = favorableDays(data.daily);

  return (
    <Card>
      <CardContent className="pt-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CloudSun className="h-4 w-4 text-primary" />
          {t('tasks.weather.suggestionTitle')}
        </h2>
        {good.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('tasks.weather.noDryDays')}</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">{t('tasks.weather.goodDaysIntro')}</p>
            <div className="flex flex-wrap gap-2">
              {good.map((day, index) => {
                const label =
                  index === 0 && day.date === data.daily?.[0]?.date
                    ? t('weather.dayToday')
                    : new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long' });
                return (
                  <span
                    key={day.date}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                  >
                    <ConditionIcon condition={day.condition} className="h-3.5 w-3.5 text-primary" />
                    <span className="capitalize">{label}</span>
                    {day.temp_max !== null && (
                      <span className="text-muted-foreground">{Math.round(day.temp_max)}°</span>
                    )}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
