import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Bell, Clock, CloudSun, Package, ShieldCheck, Wrench } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { pushBack } from '@/lib/backNavigation';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { cn } from '@/lib/utils';
import {
  type AlertSeverity,
  type DueMaintenanceAlert,
  type ExpiringWarrantyAlert,
  type LowStockAlert,
  type OverdueTaskAlert,
  type WeatherAlert,
} from '@/lib/api/alerts';
import { useAlertsSummary } from './hooks';

function severityClass(severity: AlertSeverity): string {
  return severity === 'critical'
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400';
}

interface AlertCardProps {
  to: string;
  title: string;
  meta: string;
  severityLabel: string;
  severity: AlertSeverity;
}

function AlertCard({ to, title, meta, severityLabel, severity }: AlertCardProps) {
  const location = useLocation();
  return (
    <Link to={to} state={pushBack(location)} className="group block">
      <Card className="p-3 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground group-hover:underline">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 border', severityClass(severity))}>
            {severityLabel}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}

function weatherAlertLabel(t: (k: string, o?: Record<string, unknown>) => string, item: WeatherAlert): string {
  return item.value !== null
    ? t(`alerts.weather.${item.kind}`, { value: item.value })
    : t(`alerts.weather.${item.kind}`);
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

  const summary = data ?? {
    overdue_tasks: [],
    expiring_warranties: [],
    due_maintenances: [],
    low_stock: [],
    weather_alerts: [],
    total: 0,
  };

  if (summary.total === 0) {
    return (
      <div>
        <PageHeader title={t('alerts.title')} />
        <EmptyState icon={ShieldCheck} title={t('alerts.empty')} description={t('alerts.emptyDescription')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('alerts.title')} description={t('alerts.subtitle')} />

      <div className="space-y-6">
        {summary.overdue_tasks.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-destructive" aria-hidden />
              {t('alerts.sections.overdue')}
              <span className="text-muted-foreground">({summary.overdue_tasks.length})</span>
            </h2>
            <div className="space-y-2">
              {summary.overdue_tasks.map((item: OverdueTaskAlert) => (
                <AlertCard
                  key={`task-${item.id}`}
                  to={item.entity_url}
                  title={item.title}
                  meta={t('alerts.daysOverdue', { count: item.days_overdue })}
                  severityLabel={t(`alerts.severity.${item.severity}`)}
                  severity={item.severity}
                />
              ))}
            </div>
          </section>
        ) : null}

        {summary.expiring_warranties.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              {t('alerts.sections.warranties')}
              <span className="text-muted-foreground">({summary.expiring_warranties.length})</span>
            </h2>
            <div className="space-y-2">
              {summary.expiring_warranties.map((item: ExpiringWarrantyAlert) => (
                <AlertCard
                  key={`warranty-${item.id}`}
                  to={item.entity_url}
                  title={item.title}
                  meta={t('alerts.warrantyExpiresIn', {
                    count: item.days_remaining,
                    date: item.warranty_expires_on,
                  })}
                  severityLabel={t(`alerts.severity.${item.severity}`)}
                  severity={item.severity}
                />
              ))}
            </div>
          </section>
        ) : null}

        {summary.due_maintenances.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wrench className="h-4 w-4 text-primary" aria-hidden />
              {t('alerts.sections.maintenances')}
              <span className="text-muted-foreground">({summary.due_maintenances.length})</span>
            </h2>
            <div className="space-y-2">
              {summary.due_maintenances.map((item: DueMaintenanceAlert) => (
                <AlertCard
                  key={`maintenance-${item.id}`}
                  to={item.entity_url}
                  title={item.title}
                  meta={t('alerts.maintenanceDueIn', {
                    count: item.days_remaining,
                    date: item.next_service_due,
                  })}
                  severityLabel={t(`alerts.severity.${item.severity}`)}
                  severity={item.severity}
                />
              ))}
            </div>
          </section>
        ) : null}

        {summary.low_stock.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="h-4 w-4 text-amber-500" aria-hidden />
              {t('alerts.sections.stock')}
              <span className="text-muted-foreground">({summary.low_stock.length})</span>
            </h2>
            <div className="space-y-2">
              {summary.low_stock.map((item: LowStockAlert) => (
                <AlertCard
                  key={`stock-${item.id}`}
                  to={item.entity_url}
                  title={item.title}
                  meta={`${t(`alerts.stockStatus.${item.status}`)} · ${t('alerts.stockRemaining', {
                    quantity: item.quantity,
                    unit: item.unit,
                  })}`}
                  severityLabel={t(`alerts.severity.${item.severity}`)}
                  severity={item.severity}
                />
              ))}
            </div>
          </section>
        ) : null}

        {summary.weather_alerts.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CloudSun className="h-4 w-4 text-primary" aria-hidden />
              {t('alerts.sections.weather')}
              <span className="text-muted-foreground">({summary.weather_alerts.length})</span>
            </h2>
            <div className="space-y-2">
              {summary.weather_alerts.map((item: WeatherAlert, index: number) => (
                <AlertCard
                  key={`weather-${item.kind}-${item.date}-${index}`}
                  to={item.entity_url}
                  title={weatherAlertLabel(t, item)}
                  meta={new Date(`${item.date}T00:00:00`).toLocaleDateString(i18n.language, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                  severityLabel={t(`alerts.severity.${item.severity}`)}
                  severity={item.severity}
                />
              ))}
            </div>
          </section>
        ) : null}

      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        {t('alerts.footnote')}
      </p>
    </div>
  );
}
