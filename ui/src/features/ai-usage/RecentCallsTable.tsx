import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import type { AIUsageCall } from '@/lib/api/ai-usage';

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function formatTokens(call: AIUsageCall): string {
  if (call.input_tokens === null && call.output_tokens === null) return '—';
  return `${call.input_tokens ?? 0} / ${call.output_tokens ?? 0}`;
}

export default function RecentCallsTable({ calls }: { calls: AIUsageCall[] }) {
  const { t } = useTranslation();

  if (calls.length === 0) {
    return (
      <p className="py-6 text-center text-sm italic text-muted-foreground">
        {t('aiUsage.recent.empty')}
      </p>
    );
  }

  return (
    <Card className="overflow-x-auto p-0" data-testid="ai-usage-recent">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.when')}</th>
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.feature')}</th>
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.model')}</th>
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.tokens')}</th>
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.duration')}</th>
            <th className="px-3 py-2 font-semibold">{t('aiUsage.recent.status')}</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-b border-border/50 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {formatDate(call.created_at)}
              </td>
              <td className="px-3 py-2 text-foreground">{call.feature}</td>
              <td className="px-3 py-2 text-muted-foreground">{call.model}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {formatTokens(call)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {call.duration_ms}ms
              </td>
              <td className="px-3 py-2">
                {call.success ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {t('aiUsage.recent.ok')}
                  </span>
                ) : (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    {call.error_type || t('aiUsage.recent.error')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
