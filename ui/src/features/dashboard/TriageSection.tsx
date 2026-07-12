import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Package,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { AlertSeverity, AlertsSummary } from '@/lib/api/alerts';
import { useAlertsSummary } from '@/features/alerts/hooks';

const COLLAPSED_ITEMS = 5;

interface TriageItem {
  key: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  url: string;
  severity: AlertSeverity;
}

function severityClass(severity: AlertSeverity): string {
  return severity === 'critical'
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400';
}

function buildItems(data: AlertsSummary, t: TFunction): TriageItem[] {
  const items: TriageItem[] = [
    ...data.overdue_tasks.map((item) => ({
      key: `task-${item.id}`,
      icon: Clock,
      title: item.title,
      meta: t('alerts.daysOverdue', { count: item.days_overdue }),
      url: item.entity_url,
      severity: item.severity,
    })),
    ...data.due_maintenances.map((item) => ({
      key: `maintenance-${item.id}`,
      icon: Wrench,
      title: item.title,
      meta: t('alerts.maintenanceDueIn', { count: item.days_remaining, date: item.next_service_due }),
      url: item.entity_url,
      severity: item.severity,
    })),
    ...data.expiring_warranties.map((item) => ({
      key: `warranty-${item.id}`,
      icon: ShieldAlert,
      title: item.title,
      meta: t('alerts.warrantyExpiresIn', { count: item.days_remaining, date: item.warranty_expires_on }),
      url: item.entity_url,
      severity: item.severity,
    })),
    ...data.low_stock.map((item) => ({
      key: `stock-${item.id}`,
      icon: Package,
      title: item.title,
      meta: `${t(`alerts.stockStatus.${item.status}`)} · ${t('alerts.stockRemaining', {
        quantity: item.quantity,
        unit: item.unit,
      })}`,
      url: item.entity_url,
      severity: item.severity,
    })),
  ];
  // Critical first, family order (as built) as tiebreaker — stable sort keeps it.
  return items.sort(
    (a, b) => Number(a.severity !== 'critical') - Number(b.severity !== 'critical'),
  );
}

export default function TriageSection() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data, isLoading } = useAlertsSummary();
  const [expanded, setExpanded] = React.useState(false);
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <Card className="p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.total === 0) return null;

  const items = buildItems(data, t);
  const visible = expanded ? items : items.slice(0, COLLAPSED_ITEMS);
  const hiddenCount = items.length - COLLAPSED_ITEMS;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">
          {t('dashboard.triage.title')}{' '}
          <span className="font-normal text-muted-foreground">({data.total})</span>
        </CardTitle>
        <Link to="/app/alerts" state={pushBack(location)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('alerts.viewAll')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.url}
              state={pushBack(location)}
              className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 transition-colors hover:border-border hover:bg-background"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                  {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <Badge variant="outline" className={cn('shrink-0 border', severityClass(item.severity))}>
                {t(`alerts.severity.${item.severity}`)}
              </Badge>
            </Link>
          );
        })}
      </div>
      {hiddenCount > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {t('dashboard.triage.showAll', { count: hiddenCount })}
        </button>
      ) : null}
    </Card>
  );
}
