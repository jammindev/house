import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { useToast } from '@/lib/toast';
import {
  fetchVapidPublicKey,
  sendTestWebPush,
  subscribeWebPush,
  unsubscribeWebPush,
} from '@/lib/api/webpush';
import { isIos, isPushSupported, isStandalone, urlBase64ToUint8Array } from '@/lib/pwa/platform';
import { SettingsSection } from './SettingsSection';

/**
 * Browser-side push subscription state + actions. The "subscribed" flag is read
 * from the service worker (not the server), since it reflects *this* device.
 */
function useWebPush(vapidKey: string | undefined) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setSubscribed(false);
      return;
    }
    let cancelled = false;
    // getRegistration() (not .ready) resolves to undefined when no SW is present,
    // avoiding a hang in dev where the SW is registered in prod only.
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => (reg ? reg.pushManager.getSubscription() : null))
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub));
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await subscribeWebPush(sub);
      setSubscribed(true);
      toast({ description: t('settings.push.enabledToast'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribeWebPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast({ description: t('settings.push.disabledToast'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const sent = await sendTestWebPush();
      toast({
        description: sent > 0 ? t('settings.push.testSent') : t('settings.push.testNoDevice'),
        variant: sent > 0 ? 'success' : 'default',
      });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return { subscribed, permission, busy, subscribe, unsubscribe, sendTest };
}

/**
 * Réglage « Notifications push » — active/désactive le Web Push pour cet appareil.
 * Masqué si le push n'est pas configuré côté serveur (clé VAPID vide) ou non
 * supporté par le navigateur. Sur iOS hors app installée, invite à installer
 * l'app d'abord (le push iOS n'existe que depuis l'écran d'accueil).
 */
export function WebPushSection() {
  const { t } = useTranslation();
  const { data: vapidKey, isLoading } = useQuery({
    queryKey: ['settings', 'webpush', 'vapid'],
    queryFn: fetchVapidPublicKey,
    staleTime: Infinity,
    enabled: isPushSupported(),
  });

  const configured = Boolean(vapidKey);
  const { subscribed, permission, busy, subscribe, unsubscribe, sendTest } = useWebPush(vapidKey);

  // Push non supporté par le navigateur, ou non configuré côté serveur → rien.
  if (isLoading || !isPushSupported() || !configured) return null;

  // iOS : le push n'existe que depuis la PWA installée sur l'écran d'accueil.
  if (isIos() && !isStandalone()) {
    return (
      <SettingsSection
        title={t('settings.push.title')}
        description={t('settings.push.description')}
      >
        <p className="text-sm text-muted-foreground">{t('settings.push.iosHint')}</p>
      </SettingsSection>
    );
  }

  if (permission === 'denied') {
    return (
      <SettingsSection
        title={t('settings.push.title')}
        description={t('settings.push.description')}
      >
        <p className="text-sm text-muted-foreground">{t('settings.push.permissionDenied')}</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t('settings.push.title')} description={t('settings.push.description')}>
      {subscribed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('settings.push.enabled')}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void sendTest()} disabled={busy}>
              {t('settings.push.test')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void unsubscribe()} disabled={busy}>
              {t('settings.push.disable')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('settings.push.enableHint')}</p>
          <Button onClick={() => void subscribe()} disabled={busy || subscribed === null}>
            {t('settings.push.enable')}
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
