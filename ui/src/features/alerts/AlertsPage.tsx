import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Bell, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { pushBack } from '@/lib/backNavigation';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { cn } from '@/lib/utils';
import type { AlertSeverity } from '@/lib/api/alerts';
import { EMPTY_ALERTS_SUMMARY, buildAlertSections, type AlertRow } from './rows';
import { useAlertsSummary } from './hooks';

function severityClass(severity: AlertSeverity): string {
  return severity === 'critical'
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400';
}

function AlertCard({ row, severityLabel }: { row: AlertRow; severityLabel: string }) {
  const location = useLocation();
  return (
    <Link to={row.to} state={pushBack(location)} className="group block">
      <Card className="p-3 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground group-hover:underline">{row.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.meta}</p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 border', severityClass(row.severity))}>
            {severityLabel}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}

export default function AlertsPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useAlertsSummary();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div>
        <PageHeader title={t('alerts.title')} />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const summary = data ?? EMPTY_ALERTS_SUMMARY;

  if (summary.total === 0) {
    return (
      <div>
        <PageHeader title={t('alerts.title')} />
        <EmptyState icon={ShieldCheck} title={t('alerts.empty')} description={t('alerts.emptyDescription')} />
      </div>
    );
  }

  const sections = buildAlertSections(summary, t, i18n.language);

  return (
    <div>
      <PageHeader title={t('alerts.title')} description={t('alerts.subtitle')} />

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.key}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <section.Icon className={cn('h-4 w-4', section.iconClass)} aria-hidden />
              {t(section.titleKey)}
              <span className="text-muted-foreground">({section.rows.length})</span>
            </h2>
            <div className="space-y-2">
              {section.rows.map((row) => (
                <AlertCard
                  key={row.key}
                  row={row}
                  severityLabel={t(`alerts.severity.${row.severity}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        {t('alerts.footnote')}
      </p>
    </div>
  );
}
