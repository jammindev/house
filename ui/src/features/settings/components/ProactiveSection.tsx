import { useTranslation } from 'react-i18next';

import { CheckboxField } from '@/design-system/checkbox-field';
import { Input } from '@/design-system/input';
import { SettingsSection } from './SettingsSection';
import { usePings, useTelegramStatus, useUpdatePing } from '../hooks';
import type { PingRow } from '@/lib/api/pings';

/**
 * Opt-in des messages proactifs de l'agent (pings Telegram) : un toggle + une
 * heure locale par type de ping. Tout est off par défaut ; la section ne rend
 * rien quand le canal Telegram est désactivé côté serveur ou qu'aucun ping
 * n'est disponible (modules du foyer désactivés).
 */
export function ProactiveSection() {
  const { t } = useTranslation();
  const { data: status } = useTelegramStatus();
  const { data: pings } = usePings();
  const updatePing = useUpdatePing();

  if (!status?.enabled || !pings?.length) return null;

  const linked = status.linked;

  function handleToggle(row: PingRow, enabled: boolean) {
    updatePing.mutate({ pingType: row.ping_type, payload: { enabled } });
  }

  function handleTimeChange(row: PingRow, sendAt: string) {
    if (!sendAt || sendAt === row.send_at) return;
    updatePing.mutate({
      pingType: row.ping_type,
      payload: { enabled: row.enabled, send_at: sendAt },
    });
  }

  return (
    <SettingsSection
      title={t('settings.pings.title')}
      description={t('settings.pings.description')}
    >
      <div className="space-y-3">
        {!linked && (
          <p className="text-sm text-muted-foreground">{t('settings.pings.linkFirst')}</p>
        )}
        {pings.map((row) => (
          <div
            key={row.ping_type}
            className={`flex flex-wrap items-center justify-between gap-2 ${linked ? '' : 'pointer-events-none opacity-50'}`}
          >
            <div className="min-w-0 flex-1">
              <CheckboxField
                id={`ping-${row.ping_type}`}
                label={t(`settings.pings.types.${row.ping_type}`)}
                checked={row.enabled}
                onChange={(checked) => handleToggle(row, checked)}
              />
            </div>
            <Input
              type="time"
              className="w-28"
              value={row.send_at}
              disabled={!row.enabled}
              aria-label={t('settings.pings.sendAt')}
              onChange={(e) => handleTimeChange(row, e.target.value)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t('settings.pings.hint')}</p>
      </div>
    </SettingsSection>
  );
}
