// nextjs/src/features/interactions/components/InteractionDetailView.tsx
"use client";
import { AlertCircle } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionAssociations from "@interactions/components/detail/InteractionAssociations";
import InteractionEditDialog from "@interactions/components/detail/InteractionEditDialog";
import InteractionMetadata from "@interactions/components/detail/InteractionMetadata";
import InteractionDeleteButton from "@interactions/components/InteractionDeleteButton";
import InteractionRawTextEditor from "@interactions/components/InteractionRawTextEditor";
import InteractionZonesList from "@interactions/components/InteractionZonesList";
import ImageGallery from "@interactions/components/gallery/ImageGallery";
import PdfFileList from "@interactions/components/pdf/PdfFileList";
import { useInteractionAudit } from "@interactions/hooks/useInteractionAudit";
import type { Document, Interaction } from "@interactions/types";

type InteractionDetailViewProps = {
  interaction: Interaction;
  documents: Document[];
  previews: Record<string, { view: string; download: string }>;
  fileError?: string;
  onReload: () => void;
  onDeleted: () => void;
  editOpen: boolean;
  setEditOpen: (status: boolean) => void;
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
  editOpen,
  setEditOpen,
}: InteractionDetailViewProps) {
  const { t } = useI18n();

  const { audit, loading: auditLoading } = useInteractionAudit(interaction.id, interaction.updated_at);

  const statusLabel = interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone");
  const typeLabel = t(`interactionstypes.${interaction.type}`);
  const occurredAt = interaction.occurred_at
    ? new Date(interaction.occurred_at).toLocaleString()
    : new Date(interaction.created_at).toLocaleString();
  const createdAt = new Date(interaction.created_at).toLocaleString();
  const updatedAt = new Date(interaction.updated_at).toLocaleString();
  const metadata = isObjectRecord(interaction.metadata) ? interaction.metadata : null;

  const photoDocuments = documents.filter((doc) => doc.type === "photo");
  const pdfDocuments = documents.filter((doc) => DOCUMENT_TYPES.has(doc.type));
  const hasFiles = pdfDocuments.length > 0 || photoDocuments.length > 0;
  const shouldShowFilesSection = hasFiles || Boolean(fileError);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-4 md:gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
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

          {shouldShowFilesSection && (
            <section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("interactionssections.files")}
              </h2>
              {fileError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{fileError}</span>
                </div>
              )}
              {pdfDocuments.length > 0 && (
                <PdfFileList files={pdfDocuments} previews={previews} onDeleted={onReload} />
              )}
              {photoDocuments.length > 0 && (
                <ImageGallery files={photoDocuments} previews={previews} onDeleted={onReload} />
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("interactionssections.zones")}
            </h2>
            <div className="mt-3">
              <InteractionZonesList interactionId={interaction.id} />
            </div>
          </section>

          <InteractionAssociations
            tags={interaction.tags}
            contacts={interaction.contacts}
            structures={interaction.structures}
          />

          <InteractionMetadata metadata={metadata} />

          {!auditLoading && (
            <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t("interactiondetail.auditCreated", {
                    date: createdAt,
                    user: audit?.created_by?.email ?? t("interactiondetail.unknownUser"),
                  })}
                </p>
                <p>
                  {t("interactiondetail.auditUpdated", {
                    date: updatedAt,
                    user: audit?.updated_by?.email ?? t("interactiondetail.unknownUser"),
                  })}
                </p>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm transition-colors">
            <InteractionDeleteButton interactionId={interaction.id} onDeleted={onDeleted} />
          </section>
        </div>
      </div>

      <InteractionEditDialog
        interaction={interaction}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onReload}
      />
    </div>
  );
}
