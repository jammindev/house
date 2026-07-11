import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { pushBack } from '@/lib/backNavigation';
import { fetchTrackers, formatTrackerValue } from '@/lib/api/trackers';
import { useChickenSettings, useFlockSummary, useUpdateChickenSettings } from './hooks';

/**
 * Feed autonomy (US-8): references the household's CONSUMPTION tracker — the
 * reserve and rate live there, this card only reads them. When no tracker is
 * linked yet, it offers to pick one.
 */
export default function FeedCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: settings } = useChickenSettings();
  const { data: summary } = useFlockSummary();
  const updateSettings = useUpdateChickenSettings();

  const [selecting, setSelecting] = React.useState(false);
  const [trackerId, setTrackerId] = React.useState('');

  const { data: trackers = [] } = useQuery({
    queryKey: ['trackers', 'for-feed'],
    queryFn: () => fetchTrackers(),
    enabled: selecting,
  });
  const consumptionTrackers = trackers.filter((tracker) => tracker.kind === 'consumption' && tracker.is_active);

  const feed = summary?.feed ?? null;

  if (settings && !settings.feed_tracker) {
    return (
      <Card className="p-4">
        <CardTitle className="text-sm text-muted-foreground">
          {`🌾 ${t('chickens.feed.title')}`}
        </CardTitle>
        {!selecting ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('chickens.feed.not_linked')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelecting(true)}>
              {t('chickens.feed.link_action')}
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select
              value={trackerId}
              onChange={(e) => setTrackerId(e.target.value)}
              className="max-w-xs"
              aria-label={t('chickens.feed.pick_tracker')}
            >
              <option value="">{t('chickens.feed.pick_tracker')}</option>
              {consumptionTrackers.map((tracker) => (
                <option key={tracker.id} value={tracker.id}>
                  {tracker.emoji ? `${tracker.emoji} ` : ''}{tracker.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!trackerId || updateSettings.isPending}
              onClick={() => {
                updateSettings.mutate({ feed_tracker: trackerId });
                setSelecting(false);
              }}
            >
              {t('chickens.feed.link_confirm')}
            </Button>
            {consumptionTrackers.length === 0 ? (
              <p className="w-full text-xs text-muted-foreground">
                {t('chickens.feed.no_consumption_trackers')}
              </p>
            ) : null}
          </div>
        )}
      </Card>
    );
  }

  if (!feed) return null;

  return (
    <Link to={`/app/trackers/${feed.tracker_id}`} state={pushBack(location)} className="group block">
      <Card className="p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          {`🌾 ${t('chickens.feed.title')}`}
        </CardTitle>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {feed.rate_per_day
            ? t('chickens.feed.rate', {
                rate: formatTrackerValue(feed.rate_per_day),
                unit: feed.unit,
              })
            : '—'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {feed.runway_days != null
            ? t('chickens.feed.runway', { days: feed.runway_days })
            : t('chickens.feed.no_rate_yet')}
          {feed.reserve != null
            ? ` · ${t('chickens.feed.reserve', {
                reserve: formatTrackerValue(feed.reserve),
                unit: feed.unit,
              })}`
            : ''}
        </p>
      </Card>
    </Link>
  );
}
