import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

type InteractionMetadataProps = {
  metadata: Record<string, unknown> | null;
  className?: string;
};

const hasMetadataContent = (metadata: Record<string, unknown> | null) =>
  metadata !== null && Object.keys(metadata).length > 0;

export default function InteractionMetadata({ metadata, className }: InteractionMetadataProps) {
  const { t } = useI18n();

  if (!hasMetadataContent(metadata)) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-foreground">{t("interactionssections.meta")}</h2>
      <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </section>
  );
}
