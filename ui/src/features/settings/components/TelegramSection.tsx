import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { SettingsSection } from './SettingsSection';
import { useTelegramLinkToken, useTelegramStatus, useUnlinkTelegram } from '../hooks';

/**
 * Link/unlink the user's Telegram account to chat with the agent from there.
 * Renders nothing when the channel is disabled server-side (no bot configured).
 */
export function TelegramSection() {
  const { t, i18n } = useTranslation();
  const { data: status } = useTelegramStatus();
  const linkToken = useTelegramLinkToken();
  const unlink = useUnlinkTelegram();

  if (!status?.enabled) return null;

  async function handleConnect() {
    const { deep_link } = await linkToken.mutateAsync();
    window.open(deep_link, '_blank', 'noopener');
  }

  const linkedSince = status.linked_at
    ? new Date(status.linked_at).toLocaleDateString(i18n.language)
    : '';

  return (
    <SettingsSection
      title={t('settings.telegramTitle')}
      description={t('settings.telegramDescription')}
    >
      {status.linked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {status.username
              ? t('settings.telegramLinkedAs', { username: status.username, date: linkedSince })
              : t('settings.telegramLinkedSince', { date: linkedSince })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
          >
            {t('settings.telegramUnlink')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('settings.telegramConnectHint')}</p>
          <Button onClick={() => void handleConnect()} disabled={linkToken.isPending}>
            {t('settings.telegramConnect')}
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
