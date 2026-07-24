import { useState } from 'react';
import { Share, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isIos, isStandalone } from '@/lib/pwa/platform';

const DISMISS_KEY = 'pwa_install_hint_dismissed';

/**
 * Bandeau invitant à installer la PWA sur iOS (Safari ne propose pas de prompt
 * automatique). Le Web Push iOS ne fonctionne QUE depuis l'app installée sur
 * l'écran d'accueil — ce hint est donc un prérequis fonctionnel, pas cosmétique.
 * Masqué si déjà installée, hors iOS, ou déjà rejeté.
 */
export default function InstallHint() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );

  if (dismissed || !isIos() || isStandalone()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* stockage indisponible : on masque juste pour la session */
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2 bg-primary/10 text-foreground text-sm shrink-0">
      <div className="flex items-start gap-2 min-w-0">
        <Share className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span className="min-w-0">
          <span className="font-medium">{t('pwa.install.title')}</span>{' '}
          <span className="text-muted-foreground">{t('pwa.install.iosInstructions')}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.install.dismiss')}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
