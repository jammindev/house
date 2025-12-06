// nextjs/src/features/interactions/components/InteractionDetailView.tsx
"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { format, differenceInYears, differenceInMonths, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { fr as dateFnsFr, enUS as dateFnsEn } from "date-fns/locale";
import InteractionAssociations from "@interactions/components/detail/InteractionAssociations";
import InteractionMetadata from "@interactions/components/detail/InteractionMetadata";
import InteractionDeleteButton from "@interactions/components/InteractionDeleteButton";
import InteractionRawTextEditor from "@interactions/components/InteractionRawTextEditor";
import InteractionZonesList from "@interactions/components/InteractionZonesList";
import ImageGallery from "@interactions/components/gallery/ImageGallery";
import PdfFileList from "@interactions/components/pdf/PdfFileList";
import { useInteractionAudit } from "@interactions/hooks/useInteractionAudit";
import type { FilePreview } from "@interactions/hooks/useSignedFilePreviews";
import AuditHistoryCard from "@/components/AuditHistoryCard";
import type { Document, Interaction } from "@interactions/types";
import { extractAmountFromMetadata } from "@interactions/utils/amount";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

type InteractionDetailViewProps = {
  interaction: Interaction;
  documents: Document[];
  previews: Record<string, FilePreview>;
  fileError?: string;
  onReload: () => void;
  onDeleted: () => void;
};

const DOCUMENT_TYPES = new Set(["document", "quote", "invoice", "contract", "other"]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export default function InteractionDetailView({
  interaction,
  documents,
  previews,
  fileError,
  onReload,
  onDeleted,
}: InteractionDetailViewProps) {
  const { t, locale } = useI18n();

  const { audit, loading: auditLoading } = useInteractionAudit(interaction.id, interaction.updated_at);

  // Helpers: localized public date and short relative time (14h, 1j, 1an)
  const getDateFnsLocale = (loc: string) => {
    if (!loc) return dateFnsEn;
    if (loc.startsWith("fr")) return dateFnsFr;
    return dateFnsEn;
  };

  const formatPublicDate = (isoDate?: string | null) => {
    if (!isoDate) return "";
    try {
      const d = new Date(isoDate);
      // Pp -> localized date + time, friendly for "grand public"
      return format(d, "Pp", { locale: getDateFnsLocale(locale) });
    } catch (e) {
      console.error(e)
      return new Date(isoDate).toLocaleString();
    }
  };

  const formatRelativeShort = (isoDate?: string | null) => {
    if (!isoDate) return "";
    const now = new Date();
    const d = new Date(isoDate);
    const years = differenceInYears(now, d);
    if (years >= 1) {
      // French: 1an 2ans, English: 1y 2y
      if (locale?.startsWith("fr")) return `${years}${years === 1 ? "an" : "ans"}`;
      return `${years}y`;
    }
    const months = differenceInMonths(now, d);
    if (months >= 1) {
      if (locale?.startsWith("fr")) return `${months}${months === 1 ? "mois" : "mois"}`;
      return `${months}mo`;
    }
    const days = differenceInDays(now, d);
    if (days >= 1) {
      if (locale?.startsWith("fr")) return `${days}j`;
      return `${days}d`;
    }
    const hours = differenceInHours(now, d);
    if (hours >= 1) return `${hours}h`;
    const minutes = differenceInMinutes(now, d);
    if (minutes >= 1) return `${minutes}${locale?.startsWith("fr") ? "min" : "m"}`;
    const seconds = differenceInSeconds(now, d);
    if (seconds >= 5) return `${seconds}${locale?.startsWith("fr") ? "s" : "s"}`;
    // just now
    return locale?.startsWith("fr") ? "à l'instant" : "now";
  };

  const createdAt = formatPublicDate(interaction.created_at);
  const updatedAt = formatRelativeShort(interaction.updated_at);
  const metadata = isObjectRecord(interaction.metadata) ? interaction.metadata : null;
  const quoteAmount =
    interaction.type === "quote" ? extractAmountFromMetadata(interaction.metadata) : null;
  const formattedQuoteAmount =
    quoteAmount !== null
      ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(quoteAmount)
      : null;

  const photoDocuments = documents.filter((doc) => doc.type === "photo");
  const pdfDocuments = documents.filter((doc) => DOCUMENT_TYPES.has(doc.type));
  const hasFiles = pdfDocuments.length > 0 || photoDocuments.length > 0;
  const shouldShowFilesSection = hasFiles || Boolean(fileError);

  return (
    <div className="mx-auto flex w-full flex-col gap-6 pb-12 md:gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("interactionssections.zones")}
              </h2>
              <div className="mt-3">
                <InteractionZonesList interactionId={interaction.id} />
              </div>
            </section>

            {interaction.project && (
              <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("interactiondetail.projectSectionTitle")}
                </h2>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{interaction.project.title}</p>
                    <Badge variant="outline" className="mt-2">
                      {t(`projects.status.${interaction.project.status}`)}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <LinkWithOverlay href={`/app/projects/${interaction.project.id}`}>
                      {t("interactiondetail.viewProject")}
                    </LinkWithOverlay>
                  </Button>
                </div>
              </section>
            )}
          </div>
          {interaction.type === "quote" && (
            <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 shadow-sm transition-colors">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                {t("interactiondetail.quoteSectionTitle")}
              </h2>
              {formattedQuoteAmount ? (
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    {t("interactiondetail.quoteAmountLabel")}
                  </span>
                  <p className="text-2xl font-semibold text-emerald-900">{formattedQuoteAmount}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-emerald-800">{t("interactiondetail.quoteAmountMissing")}</p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("interactionssections.description")}
            </h2>
            <div className="mt-4 text-sm leading-relaxed text-foreground">
              <InteractionRawTextEditor
                interactionId={interaction.id}
                initialContent={interaction.content}
                onSaved={onReload}
              />
            </div>
          </section>

          <InteractionAssociations
            tags={interaction.tags}
            contacts={interaction.contacts}
            structures={interaction.structures}
          />

          {shouldShowFilesSection && (
            <>
              {pdfDocuments.length > 0 && (<section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("interactionssections.documents")}
                </h2>
                {fileError && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{fileError}</span>
                  </div>
                )}
                <PdfFileList files={pdfDocuments} previews={previews} onDeleted={onReload} />
              </section>)}
              {photoDocuments.length > 0 && (<section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("interactionssections.photoGallery")}
                </h2>
                {fileError && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{fileError}</span>
                  </div>
                )}
                {photoDocuments.length > 0 && (
                  <ImageGallery files={photoDocuments} previews={previews} onDeleted={onReload} />
                )}
              </section>)}

            </>
          )}
        </div>

        <InteractionMetadata metadata={metadata} />

        <AuditHistoryCard
          loading={auditLoading}
          lines={[
            t("interactiondetail.auditCreated", {
              date: createdAt,
              user: audit?.created_by?.username ?? audit?.created_by?.email ?? t("interactiondetail.unknownUser"),
            }),
            t("interactiondetail.auditUpdated", {
              date: updatedAt,
              user: audit?.updated_by?.username ?? audit?.updated_by?.email ?? t("interactiondetail.unknownUser"),
            }),
          ]}
          actions={<InteractionDeleteButton interactionId={interaction.id} onDeleted={onDeleted} />}
        />
      </div>
    </div>
  );
}
