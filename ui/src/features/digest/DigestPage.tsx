import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
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

import { DIGEST_PING_TYPE, digestKeys, useDigest } from './hooks';

export default function DigestPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: preview, isLoading } = useDigest();
  const { data: user } = useCurrentUser();
  const { data: pings } = usePings();
  const { data: telegram } = useTelegramStatus();
  const updatePing = useUpdatePing();
  const updateProfile = useUpdateProfile();

  const showSkeleton = useDelayedLoading(isLoading);

  const digestPing = pings?.find((p) => p.ping_type === DIGEST_PING_TYPE);
  const disabled = new Set(user?.digest_disabled_sections ?? []);
  const telegramLinked = Boolean(telegram?.linked);
  const telegramAvailable = Boolean(telegram?.enabled);

  const refreshPreview = () =>
    void qc.invalidateQueries({ queryKey: digestKeys.preview() });

  function handleEnableToggle(enabled: boolean) {
    updatePing.mutate({ pingType: DIGEST_PING_TYPE, payload: { enabled } });
  }

  function handleTimeChange(sendAt: string) {
    if (!digestPing || !sendAt || sendAt === digestPing.send_at) return;
    updatePing.mutate({
      pingType: DIGEST_PING_TYPE,
      payload: { enabled: digestPing.enabled, send_at: sendAt },
    });
  }

  function handleSectionToggle(key: string, enabled: boolean) {
    const next = new Set(disabled);
    if (enabled) next.delete(key);
    else next.add(key);
    updateProfile.mutate(
      { digest_disabled_sections: [...next] },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ['settings', 'me'] });
          refreshPreview();
        },
      },
    );
  }

  return (
    <div>
      <PageHeader title={t('digest.title')} description={t('digest.description')} />

      <div className="space-y-6">
        {/* Delivery — enable + send time (backed by the shared daily_digest ping) */}
        {telegramAvailable && digestPing ? (
          <Card className="p-4">
            <CardTitle className="mb-3">{t('digest.delivery.title')}</CardTitle>
            {!telegramLinked && (
              <p className="mb-3 text-sm text-muted-foreground">
                {t('digest.delivery.linkFirst')}
              </p>
            )}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${
                telegramLinked ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <CheckboxField
                id="digest-enabled"
                label={t('digest.delivery.enable')}
                checked={digestPing.enabled}
                onChange={handleEnableToggle}
              />
              <Input
                type="time"
                className="w-28"
                value={digestPing.send_at}
                disabled={!digestPing.enabled}
                aria-label={t('digest.delivery.sendAt')}
                onChange={(e) => handleTimeChange(e.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t('digest.delivery.hint')}</p>
          </Card>
        ) : null}

        {/* Sections — per-user on/off, gated by the household's enabled modules */}
        {preview && preview.available_sections.length > 0 ? (
          <Card className="p-4">
            <CardTitle className="mb-1">{t('digest.sections.title')}</CardTitle>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('digest.sections.description')}
            </p>
            <div className="space-y-2">
              {preview.available_sections.map((s) => (
                <CheckboxField
                  key={s.key}
                  id={`digest-section-${s.key}`}
                  label={t(`digest.sections.${s.key}`)}
                  checked={!disabled.has(s.key)}
                  onChange={(checked) => handleSectionToggle(s.key, checked)}
                />
              ))}
            </div>
          </Card>
        ) : null}

        {/* Live preview of today's digest */}
        <Card className="p-4">
          <CardTitle className="mb-3">🔎 {t('digest.preview.title')}</CardTitle>
          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : preview && preview.sections.length > 0 ? (
            <div className="space-y-4">
              {preview.sections.map((section) => (
                <div key={section.key}>
                  <p className="mb-1 font-medium text-foreground">
                    {section.emoji} {section.title}
                  </p>
                  <ul className="space-y-0.5 text-sm text-muted-foreground">
                    {section.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sun}
              title={t('digest.preview.emptyTitle')}
              description={t('digest.preview.emptyDescription')}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

DigestPage.Icon = Sparkles;
