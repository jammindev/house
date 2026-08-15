import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useAlertsSummary } from '@/features/alerts/hooks';

/**
 * Le salut, et la ligne qui dit où en est le foyer.
 *
 * ⚠️ **Un total à zéro a deux sens**, et les confondre a produit l'accueil d'un
 * foyer né trente secondes plus tôt : « tout est sous contrôle, rien ne demande
 * votre attention ». C'est faux — l'app ne sait rien, elle ne contrôle rien.
 * Quatrième occurrence du même défaut après `coverage.window_status()`,
 * `inflow_nature == ""` et `Document.purpose` vide, et la plus trompeuse des
 * quatre, parce que celle-ci rassure.
 *
 * La raison arrive dans **la même réponse** que le total (`household_is_empty`,
 * servi par `/api/alerts/summary/`) : un second appel arriverait après, et
 * l'écran passerait de « tout va bien » à « bienvenue » sous les yeux du
 * lecteur.
 */
export default function HeroGreeting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useAlertsSummary();

  const name = user?.full_name || user?.email || '';
  const total = data?.total;
  const isEmpty = data?.household_is_empty;

  function pulse() {
    if (total === undefined) return ' ';
    if (isEmpty) return t('dashboard.hero.emptyHousehold');
    return total === 0
      ? t('dashboard.hero.allClear')
      : t('dashboard.hero.attention', { count: total });
  }

  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {isEmpty
          ? t('dashboard.hero.welcome', { name })
          : t('dashboard.hero.greeting', { name })}
      </h1>
      <p className="text-sm text-muted-foreground">{pulse()}</p>
    </header>
  );
}
