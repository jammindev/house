import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Smartphone, Trash2 } from 'lucide-react';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { useCreateDeviceToken, useDeviceTokens, useRevokeDeviceToken } from '../hooks';
import { SettingsSection } from './SettingsSection';

/**
 * Les appareils autorisés à envoyer des photos sans mot de passe.
 *
 * ⚠️ **Le secret ne s'affiche qu'une fois.** Le serveur n'en garde que l'empreinte :
 * il n'y a pas de « le revoir plus tard ». L'écran le dit explicitement au moment
 * où il l'affiche — un secret qu'on croit pouvoir relire est un secret qu'on ne
 * copie pas.
 */
export function DevicesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: tokens = [], isLoading } = useDeviceTokens();
  const createToken = useCreateDeviceToken();
  const revokeToken = useRevokeDeviceToken();

  const [name, setName] = React.useState('');
  const [issued, setIssued] = React.useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createToken.mutate(trimmed, {
      onSuccess: (token) => {
        setIssued(token.token);
        setName('');
      },
    });
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      toast({ description: t('settings.devices.copied'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  };

  const active = tokens.filter((token) => !token.is_revoked);

  return (
    <SettingsSection title={t('settings.devices.title')} description={t('settings.devices.subtitle')}>
      <div className="space-y-4">
        {issued ? (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <p className="text-sm font-medium text-foreground">
              {t('settings.devices.issuedTitle')}
            </p>
            {/* Le seul moment où le secret existe en clair. */}
            <code className="block break-all rounded-md bg-background p-2 font-mono text-xs text-foreground">
              {issued}
            </code>
            <p className="text-xs text-muted-foreground">{t('settings.devices.issuedOnce')}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={copy} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                {t('settings.devices.copy')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setIssued(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="device-name" className="text-sm font-medium text-foreground">
              {t('settings.devices.nameLabel')}
            </label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.devices.namePlaceholder')}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={createToken.isPending || !name.trim()}>
            {t('settings.devices.create')}
          </Button>
        </form>

        {isLoading ? (
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.devices.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {active.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {token.last_used_at
                        ? t('settings.devices.lastUsed', {
                            date: formatDateTime(token.last_used_at),
                          })
                        : t('settings.devices.neverUsed')}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => revokeToken.mutate(token.id)}
                  className="gap-1.5 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('settings.devices.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}
