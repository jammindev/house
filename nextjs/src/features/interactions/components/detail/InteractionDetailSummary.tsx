import { useI18n } from "@/lib/i18n/I18nProvider";

type InteractionDetailSummaryProps = {
  subject: string;
  typeLabel: string;
  statusLabel: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export default function InteractionDetailSummary({
  subject,
  typeLabel,
  statusLabel,
  occurredAt,
  createdAt,
  updatedAt,
}: InteractionDetailSummaryProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-lg border border-gray-200 bg-white/70 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">{t("interactionssections.details")}</h2>
      <dl className="grid gap-y-3 sm:grid-cols-2 sm:gap-x-6 text-sm text-gray-700">
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("common.subject")}</dt>
          <dd className="mt-0.5 text-gray-800">{subject}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("interactionstypeLabel")}</dt>
          <dd className="mt-0.5 text-gray-800">{typeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("interactionsstatusLabel")}</dt>
          <dd className="mt-0.5 text-gray-800">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("interactionsoccurredAtLabel")}</dt>
          <dd className="mt-0.5 text-gray-800">{occurredAt}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("interactiondetail.createdAt")}</dt>
          <dd className="mt-0.5 text-gray-800">{createdAt}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-gray-500">{t("interactiondetail.updatedAt")}</dt>
          <dd className="mt-0.5 text-gray-800">{updatedAt}</dd>
        </div>
      </dl>
    </section>
  );
}
