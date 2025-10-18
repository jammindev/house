import { useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionAssociations from "@interactions/components/detail/InteractionAssociations";
import InteractionEditDialog from "@interactions/components/detail/InteractionEditDialog";
import InteractionDetailHeader from "@interactions/components/detail/InteractionDetailHeader";
import InteractionDetailSummary from "@interactions/components/detail/InteractionDetailSummary";
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
  const { t } = useI18n();

  const [editOpen, setEditOpen] = useState(false);
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

  return (
    <div className="max-w-3xl mx-auto md:p-6 space-y-8">
      <InteractionDetailHeader
        interaction={interaction}
        typeLabel={typeLabel}
        statusLabel={statusLabel}
        occurredAt={occurredAt}
        onReload={onReload}
        onEdit={() => setEditOpen(true)}
      />

      <InteractionDetailSummary
        subject={interaction.subject}
        typeLabel={typeLabel}
        statusLabel={statusLabel}
        occurredAt={occurredAt}
        createdAt={createdAt}
        updatedAt={updatedAt}
      />

      <InteractionAssociations
        tags={interaction.tags}
        contacts={interaction.contacts}
        structures={interaction.structures}
      />

      <InteractionMetadata metadata={metadata} />

      <InteractionZonesList interactionId={interaction.id} />
      <InteractionRawTextEditor interactionId={interaction.id} initialContent={interaction.content} onSaved={onReload} />

      {fileError && (
        <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
          {fileError}
        </div>
      )}

      {pdfDocuments.length > 0 && <PdfFileList files={pdfDocuments} previews={previews} onDeleted={onReload} />}

      {photoDocuments.length > 0 && <ImageGallery files={photoDocuments} previews={previews} onDeleted={onReload} />}

      <InteractionDeleteButton interactionId={interaction.id} onDeleted={onDeleted} />

      {!auditLoading && (
        <div className="text-xs text-gray-400 text-right space-y-1">
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
      )}

      <InteractionEditDialog
        interaction={interaction}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onReload}
      />
    </div>
  );
}
