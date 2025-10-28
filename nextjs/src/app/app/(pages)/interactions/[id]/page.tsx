// nextjs/src/app/app/interactions/[id]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import AppPageLayout from "@/components/layout/AppPageLayout";
import InteractionDetailView from "@interactions/components/InteractionDetailView";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import { useInteraction } from "@interactions/hooks/useInteraction";
import { useState } from "react";
import { Pencil } from "lucide-react";
import InteractionAttachmentImport from "@/features/interactions/components/InteractionAttachmentImport";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { interaction, documents, loading, error, reload } = useInteraction(id);
  const { previews, error: fileError } = useSignedFilePreviews(documents);

  const [editOpen, setEditOpen] = useState(false);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!interaction) return <div className="p-6 text-gray-500">{t("interactionsnotFound")}</div>;

  const typeLabel = interaction.type ? t(`interactionstypes.${interaction.type}`) : undefined;
  const statusLabel = interaction.status ? t(`interactionsstatus.${interaction.status}`) : undefined;
  const occuredAt = interaction.occurred_at

  const subtitle = `${new Date(occuredAt).toLocaleDateString()} - ${statusLabel}`
  return (
    <AppPageLayout
      title={interaction.subject || t("interactionsdetail")}
      context={typeLabel}
      subtitle={subtitle}
      actions={[{ icon: Pencil, onClick: () => setEditOpen(true) }, {
        element: (
          <InteractionAttachmentImport
            interactionId={interaction.id}
            onUploaded={reload}
          />
        ),
      },]}

    >
      <InteractionDetailView
        interaction={interaction}
        documents={documents}
        previews={previews}
        fileError={fileError}
        onReload={reload}
        onDeleted={() => router.push("/app/interactions")}
        editOpen={editOpen}
        setEditOpen={setEditOpen}
      />
    </AppPageLayout>
  );
}
