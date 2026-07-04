import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import type { AIUsageHistogram } from '@/lib/api/ai-usage';

// Feature → design-token shade. Cycled when new features appear — plain CSS
// tokens only, no chart library.
const FEATURE_TONES = [
  'bg-primary',
  'bg-primary/60',
  'bg-primary/35',
  'bg-foreground/40',
  'bg-destructive/50',
  'bg-foreground/20',
];

export default function UsageHistogram({ histogram }: { histogram: AIUsageHistogram }) {
  const { t } = useTranslation();
  const toneByFeature = new Map(
    histogram.features.map((f, i) => [f, FEATURE_TONES[i % FEATURE_TONES.length]]),
  );
  const max = Math.max(
    1,
    ...histogram.days.map((d) => Object.values(d.counts).reduce((a, b) => a + b, 0)),
  );

  return (
    <Card className="p-4" data-testid="ai-usage-histogram">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('aiUsage.histogram.title')}
      </p>
      <div className="flex h-32 items-end gap-[2px]">
        {histogram.days.map((day) => {
          const total = Object.values(day.counts).reduce((a, b) => a + b, 0);
          return (
            <div
              key={day.date}
              className="group relative flex flex-1 flex-col-reverse overflow-hidden rounded-sm"
              style={{ height: `${(total / max) * 100}%` }}
              title={`${day.date} — ${total}`}
            >
              {histogram.features.map((feature) => {
                const count = day.counts[feature] ?? 0;
                if (!count) return null;
                return (
                  <div
                    key={feature}
                    className={toneByFeature.get(feature)}
                    style={{ height: `${(count / Math.max(total, 1)) * 100}%` }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{histogram.days[0]?.date}</span>
        <span>{histogram.days[histogram.days.length - 1]?.date}</span>
      </div>
      {histogram.features.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {histogram.features.map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${toneByFeature.get(feature)}`} />
              {feature}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-muted-foreground">
          {t('aiUsage.histogram.empty')}
        </p>
      )}
    </Card>
  );
}
