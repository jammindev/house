import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Card, CardTitle } from '@/design-system/card';
import { CheckboxField } from '@/design-system/checkbox-field';
import { Input } from '@/design-system/input';
import {
  useCurrentUser,
  usePings,
  useTelegramStatus,
  useUpdatePing,
  useUpdateProfile,
} from '@/features/settings/hooks';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { pushBack } from '@/lib/backNavigation';
import {
  RECAP_PING_TYPE,
  recapKeys,
  useLatestRecap,
  useRecapChapters,
  useRecapHistory,
} from './hooks';
import { monthLabel } from './month';

export default function RecapHistoryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const location = useLocation();
  const latestQuery = useLatestRecap();
  const historyQuery = useRecapHistory();
  const chaptersQuery = useRecapChapters();

  const { data: user } = useCurrentUser();
  const { data: pings } = usePings();
  const { data: telegram } = useTelegramStatus();
  const updatePing = useUpdatePing();
  const updateProfile = useUpdateProfile();

  const recapPing = pings?.find((p) => p.ping_type === RECAP_PING_TYPE);
  const mutedChapters = new Set(user?.recap_disabled_chapters ?? []);

  function handleChapterToggle(key: string, enabled: boolean) {
    const next = new Set(mutedChapters);
    if (enabled) next.delete(key);
    else next.add(key);
    updateProfile.mutate(
      { recap_disabled_chapters: [...next] },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ['settings', 'me'] });
          // Muting a chapter is a *read* preference: the snapshot is untouched, but
          // what the server renders changes, so the cached recaps must go.
          void qc.invalidateQueries({ queryKey: recapKeys.all });
        },
      },
    );
  }

  const isLoading = latestQuery.isLoading || historyQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  const latest = latestQuery.data ?? null;
  // The freshest month gets the staging; the rest is a sober list — nobody replays
  // the story of March.
  const past = (historyQuery.data ?? []).filter(
    (recap) => recap.month !== latest?.month && recap.card_count > 0,
  );

  return (
    <>
      <PageHeader title={t('recap.title')} description={t('recap.description')} />

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {isLoading ? null : !latest && past.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t('recap.empty')}
          description={t('recap.emptyDescription')}
        />
      ) : (
        <div className="space-y-5">
          {latest ? (
            <Link
              to={`/app/recap/${latest.month}`}
              state={pushBack(location)}
              className="group block text-foreground hover:text-primary"
            >
              <Card className="p-4">
                <CardTitle className="text-inherit capitalize [&>span:last-child]:group-hover:underline">
                  ✨ {monthLabel(latest.month)}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('recap.cardCount', { count: latest.card_count })}
                </p>
                <p className="mt-2 text-sm font-medium text-primary">{t('recap.open')}</p>
              </Card>
            </Link>
          ) : null}

          {past.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{t('recap.history')}</h2>
              <div className="space-y-2">
                {past.map((recap) => (
                  <Link
                    key={recap.id}
                    to={`/app/recap/${recap.month}`}
                    state={pushBack(location)}
                    className="group block text-foreground hover:text-primary"
                  >
                    <Card className="flex items-center justify-between gap-3 p-3">
                      <CardTitle className="text-inherit capitalize [&>span:last-child]:group-hover:underline">
                        {monthLabel(recap.month)}
                      </CardTitle>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('recap.cardCount', { count: recap.card_count })}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Delivery — the monthly appointment, off by default (see below). */}
      {telegram?.enabled && recapPing ? (
        <Card className="mt-6 p-4">
          <CardTitle className="mb-3">{t('recap.delivery.title')}</CardTitle>
          {!telegram.linked ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {t('recap.delivery.linkFirst')}
            </p>
          ) : null}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 ${
              telegram.linked ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            <CheckboxField
              id="recap-enabled"
              label={t('recap.delivery.enable')}
              checked={recapPing.enabled}
              onChange={(enabled) =>
                updatePing.mutate({ pingType: RECAP_PING_TYPE, payload: { enabled } })
              }
            />
            <Input
              type="time"
              className="w-28"
              value={recapPing.send_at}
              disabled={!recapPing.enabled}
              aria-label={t('recap.delivery.sendAt')}
              onChange={(e) => {
                const sendAt = e.target.value;
                if (!sendAt || sendAt === recapPing.send_at) return;
                updatePing.mutate({
                  pingType: RECAP_PING_TYPE,
                  payload: { enabled: recapPing.enabled, send_at: sendAt },
                });
              }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t('recap.delivery.hint')}</p>
        </Card>
      ) : null}

      {/* Chapters — a read preference, per user. */}
      {(chaptersQuery.data ?? []).length > 0 ? (
        <Card className="mt-4 p-4">
          <CardTitle className="mb-1">{t('recap.chapters.title')}</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('recap.chapters.description')}
          </p>
          <div className="space-y-2">
            {(chaptersQuery.data ?? []).map((key) => (
              <CheckboxField
                key={key}
                id={`recap-chapter-${key}`}
                label={t(`recap.chapters.${key}`)}
                checked={!mutedChapters.has(key)}
                onChange={(checked) => handleChapterToggle(key, checked)}
              />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
