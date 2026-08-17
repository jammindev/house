import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { pushBack } from '@/lib/backNavigation';
import { useLatestRecap } from '@/features/recap/hooks';
import { monthLabel } from '@/features/recap/month';
import { useCurrentUser, useUpdateProfile } from '@/features/settings/hooks';

/**
 * The nudge that makes the recap findable without being looked for: on the 1st, the
 * fresh month sits at the top of the dashboard.
 *
 * It renders nothing at all when there is no fresh recap — the API answers `204`
 * below `RECAP_MIN_CARDS`, so a month with too little to tell never knocks. And once
 * dismissed it stays dismissed for that month.
 *
 * The "seen" flag lives on the **account** (`User.recap_dismissed_month`), next to
 * `recap_disabled_chapters` — same nature, a read preference that never touches the
 * frozen snapshot. It used to live in `sessionStorage`, and the comment here used to
 * call the cost acceptable: "the card reappears in another browser". It reappeared
 * far more often than that — the flag died with the tab, so a new tab was enough to
 * bring the card back on the very same machine (#626). Closing a card is something a
 * person did, not something a tab did.
 *
 * The month, not a boolean: that is what lets next month's recap speak up on its own.
 */
export default function RecapTeaserCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: recap } = useLatestRecap();
  const { data: user } = useCurrentUser();
  const dismiss = useUpdateProfile();

  // Read the month back from the in-flight mutation so the card leaves on click
  // instead of after the round-trip — but only while that write still stands: on
  // error we fall back to the server's value and the card comes back, rather than
  // staying hidden on a preference nobody managed to save.
  const optimisticMonth = dismiss.isError ? undefined : dismiss.variables?.recap_dismissed_month;
  const dismissedMonth = optimisticMonth ?? user?.recap_dismissed_month ?? '';

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
        onClick={() => dismiss.mutate({ recap_dismissed_month: recap.month })}
        aria-label={t('common.close')}
      >
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}
