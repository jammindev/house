import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useAlertsSummary } from '@/features/alerts/hooks';

/** Compact greeting: first name + one-line pulse derived from the alerts summary. */
export default function HeroGreeting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useAlertsSummary();

  const name = user?.first_name || user?.email || '';
  const total = data?.total;

  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t('dashboard.hero.greeting', { name })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {total === undefined
          ? ' '
          : total === 0
            ? t('dashboard.hero.allClear')
            : t('dashboard.hero.attention', { count: total })}
      </p>
    </header>
  );
}
