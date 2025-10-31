// nextjs/src/app/app/(pages)/interactions/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionDetailView from "@interactions/components/InteractionDetailView";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import { useInteraction } from "@interactions/hooks/useInteraction";
import { Pencil } from "lucide-react";
import InteractionAttachmentImport from "@/features/interactions/components/InteractionAttachmentImport";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { interaction, documents, loading, error, reload } = useInteraction(id);
  const { previews, error: fileError } = useSignedFilePreviews(documents);
  const setPageLayoutConfig = usePageLayoutConfig();

  const [editOpen, setEditOpen] = useState(false);

  const interactionId = interaction?.id;
  const interactionSubject = interaction?.subject;
  const typeLabel = interaction?.type ? t(`interactionstypes.${interaction.type}`) : undefined;
  const statusLabel = interaction?.status ? t(`interactionsstatus.${interaction.status}`) : undefined;
  const occurredAtLabel = interaction?.occurred_at
    ? new Date(interaction.occurred_at).toLocaleDateString()
    : undefined;
  const subtitle = [occurredAtLabel, statusLabel].filter(Boolean).join(" - ") || undefined;

  const layoutActions = useMemo(() => {
    if (!interactionId) return undefined;

    return [
      { icon: Pencil, onClick: () => setEditOpen(true) },
      {
        element: (
          <InteractionAttachmentImport interactionId={interactionId} onUploaded={reload} />
        ),
      },
    ];
  }, [interactionId, reload]);

  useEffect(() => {
    if (!interaction) {
      setPageLayoutConfig({
        title: t("interactionsdetail"),
        subtitle: undefined,
        context: undefined,
        actions: undefined,
        hideBackButton: false,
        className: undefined,
        contentClassName: undefined,
        loading: false,
      });
      return;
    }

    setPageLayoutConfig({
      title: interactionSubject || t("interactionsdetail"),
      context: typeLabel,
      subtitle,
      actions: layoutActions,
      hideBackButton: false,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [
    interaction,
    interactionSubject,
    layoutActions,
    setPageLayoutConfig,
    subtitle,
    t,
    typeLabel,
  ]);

  if (loading) {
    return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!interaction) {
    return <div className="p-6 text-gray-500">{t("interactionsnotFound")}</div>;
  }

  return (
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
  );
}
