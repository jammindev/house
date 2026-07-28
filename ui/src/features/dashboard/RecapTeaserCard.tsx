import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { useSessionState } from '@/lib/useSessionState';
import { pushBack } from '@/lib/backNavigation';
import { useLatestRecap } from '@/features/recap/hooks';
import { monthLabel } from '@/features/recap/month';

/**
 * The nudge that makes the recap findable without being looked for: on the 1st, the
 * fresh month sits at the top of the dashboard.
 *
 * It renders nothing at all when there is no fresh recap — the API answers `204`
 * below `RECAP_MIN_CARDS`, so a month with too little to tell never knocks. And once
 * dismissed it stays dismissed for that month.
 *
 * The "seen" flag lives client-side on purpose: a table (and an endpoint, and a
 * migration) to remember that someone closed a card is more machinery than the
 * problem deserves. Cost of that choice, accepted: the card reappears in another
 * browser.
 */
export default function RecapTeaserCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: recap } = useLatestRecap();
  const [dismissedMonth, setDismissedMonth] = useSessionState<string>('recap.dismissed', '');

  if (!recap || recap.card_count === 0) return null;
  if (dismissedMonth === recap.month) return null;

  return (
    <Card className="flex items-start justify-between gap-3 border-primary/30 bg-primary/5 p-4">
      <Link
        to={`/app/recap/${recap.month}`}
        state={pushBack(location)}
        className="group min-w-0 flex-1 text-foreground hover:text-primary"
      >
        <CardTitle className="text-inherit capitalize [&>span:last-child]:group-hover:underline">
          🎉 {monthLabel(recap.month)}
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('recap.teaser.ready', { count: recap.card_count })}
        </p>
        <p className="mt-2 text-sm font-medium text-primary">{t('recap.open')}</p>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDismissedMonth(recap.month)}
        aria-label={t('common.close')}
      >
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}
