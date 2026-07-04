import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/design-system/card';
import type { AIUsageSummary, AIUsageWindow } from '@/lib/api/ai-usage';

const WINDOW_ORDER = ['24h', '7d', '30d'] as const;

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function Metric({
  label,
  value,
  alert,
  alertLabel,
}: {
  label: string;
  value: string;
  alert?: boolean;
  alertLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1 text-sm font-medium ${
          alert ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {alert ? (
          <AlertTriangle className="h-3 w-3" aria-label={alertLabel} />
        ) : null}
        {value}
      </span>
    </div>
  );
}

export default function KpiCards({ summary }: { summary: AIUsageSummary }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 md:grid-cols-3" data-testid="ai-usage-kpis">
      {WINDOW_ORDER.map((key) => {
        const window: AIUsageWindow | undefined = summary.windows[key];
        if (!window) return null;
        return (
          <Card key={key} className="space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`aiUsage.windows.${key}`)}
              </p>
              <p className="text-2xl font-semibold text-foreground">{window.calls}</p>
            </div>
            <div className="space-y-1.5 border-t border-border pt-2">
              <Metric
                label={t('aiUsage.metrics.errorRate')}
                value={formatRate(window.error_rate)}
              />
              <Metric
                label={t('aiUsage.metrics.p95')}
                value={formatMs(window.p95_ms)}
                alert={window.alerts.p95_ms}
                alertLabel={t('aiUsage.alerts.p95')}
              />
              <Metric
                label={t('aiUsage.metrics.idkRate')}
                value={formatRate(window.idk_rate)}
                alert={window.alerts.idk_rate}
                alertLabel={t('aiUsage.alerts.idk')}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
