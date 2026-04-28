import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import type { AlertSeverity } from '@/lib/api/alerts';
import { useAlertsSummary } from './hooks';

const MAX_ITEMS = 5;

interface CompactItem {
  id: string;
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

export default function AlertsSection() {
  const { t } = useTranslation();
  const { data } = useAlertsSummary();

  if (!data || data.total === 0) return null;

  const items: CompactItem[] = [
    ...data.overdue_tasks.map((item) => ({
      id: `task-${item.id}`,
      title: item.title,
      meta: t('alerts.daysOverdue', { count: item.days_overdue }),
      url: item.entity_url,
      severity: item.severity,
    })),
    ...data.expiring_warranties.map((item) => ({
      id: `warranty-${item.id}`,
      title: item.title,
      meta: t('alerts.warrantyExpiresIn', { count: item.days_remaining, date: item.warranty_expires_on }),
      url: item.entity_url,
      severity: item.severity,
    })),
    ...data.due_maintenances.map((item) => ({
      id: `maintenance-${item.id}`,
      title: item.title,
      meta: t('alerts.maintenanceDueIn', { count: item.days_remaining, date: item.next_service_due }),
      url: item.entity_url,
      severity: item.severity,
    })),
  ].slice(0, MAX_ITEMS);

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
                <Bell className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle className="text-lg">{t('alerts.dashboardSectionTitle')}</CardTitle>
            </div>
            <CardDescription>{t('alerts.dashboardSectionDescription', { count: data.total })}</CardDescription>
          </div>
          <Link to="/app/alerts" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {t('alerts.viewAll')}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.url}
            className="group block rounded-xl border border-border/70 bg-background/80 p-3 transition-colors hover:border-border hover:bg-background"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:underline">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <Badge variant="outline" className={cn('shrink-0 border', severityClass(item.severity))}>
                {t(`alerts.severity.${item.severity}`)}
              </Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
