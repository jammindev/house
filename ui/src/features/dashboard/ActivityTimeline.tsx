import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Receipt,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { buttonVariants } from '@/design-system/button';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useRecentActivity } from './hooks';

const TYPE_ICONS: Record<string, LucideIcon> = {
  note: FileText,
  expense: Receipt,
  maintenance: Wrench,
  repair: Wrench,
};

function relativeDate(iso: string, locale: string, t: (key: string) => string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t('dashboard.activity.today');
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (days < 30) return rtf.format(-days, 'day');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export default function ActivityTimeline() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { data: interactions = [], isLoading } = useRecentActivity();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <Card className="p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (interactions.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{t('dashboard.activity.title')}</CardTitle>
        <Link
          to="/app/interactions"
          state={pushBack(location)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {t('dashboard.activity.cta')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ol className="space-y-1">
        {interactions.map((item) => {
          const Icon = TYPE_ICONS[item.type] ?? Sparkles;
          return (
            <li key={item.id}>
              <Link
                to={`/app/interactions/${item.id}`}
                state={pushBack(location)}
                className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {item.subject}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDate(item.occurred_at, i18n.language, t)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
