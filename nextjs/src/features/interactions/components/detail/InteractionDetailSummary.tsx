import { useMemo } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";

type InteractionDetailSummaryProps = {
  typeLabel: string;
  statusLabel: string;
  occurredAt: string;
};

type SummaryItem = {
  label: string;
  value: string;
};

export default function InteractionDetailSummary({
  typeLabel,
  statusLabel,
  occurredAt,
}: InteractionDetailSummaryProps) {
  const { t } = useI18n();

  const items = useMemo<SummaryItem[]>(
    () => [
      {
        label: t("interactionstypeLabel"),
        value: typeLabel,
      },
      {
        label: t("interactionsstatusLabel"),
        value: statusLabel,
      },
      {
        label: t("interactionsoccurredAtLabel"),
        value: occurredAt,
      },
    ],
    [occurredAt, statusLabel, t, typeLabel],
  );

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
      <h2 className="text-sm font-semibold text-foreground">{t("interactionssections.details")}</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
