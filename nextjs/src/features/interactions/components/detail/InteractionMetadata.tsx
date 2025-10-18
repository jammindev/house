import { useI18n } from "@/lib/i18n/I18nProvider";

type InteractionMetadataProps = {
  metadata: Record<string, unknown> | null;
};

const hasMetadataContent = (metadata: Record<string, unknown> | null) =>
  metadata !== null && Object.keys(metadata).length > 0;

export default function InteractionMetadata({ metadata }: InteractionMetadataProps) {
  const { t } = useI18n();

  if (!hasMetadataContent(metadata)) {
    return null;
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white/70 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800">{t("interactionssections.meta")}</h2>
      <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </section>
  );
}
