// nextjs/src/app/app/(pages)/interactions/[id]/page.tsx
"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Notebook, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import InteractionDetailView from "@interactions/components/InteractionDetailView";
import { useInteraction } from "@interactions/hooks/useInteraction";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import InteractionAttachmentImport from "@/features/interactions/components/InteractionAttachmentImport";
import VisibilityToggleButton from "@shared/components/VisibilityToggleButton";
import { useToast } from "@/components/ToastProvider";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { show } = useToast();
  const { user } = useGlobal();
  const { interaction, documents, loading, error, reload, deleteInteraction } = useInteraction(id);
  const { previews, error: fileError } = useSignedFilePreviews(documents);

  const returnTo = searchParams.get('returnTo');

  const interactionId = interaction?.id;
  const interactionSubject = interaction?.subject;
  const typeLabel = interaction?.type ? t(`interactionstypes.${interaction.type}`) : undefined;
  const statusLabel = interaction?.status ? t(`interactionsstatus.${interaction.status}`) : undefined;
  const occurredAtLabel = interaction?.occurred_at
    ? new Date(interaction.occurred_at).toLocaleDateString()
    : undefined;
  const subtitle = [occurredAtLabel, statusLabel].filter(Boolean).join(" · ") || undefined;
  const title = interactionSubject || t("interactionsdetail");

  const layoutActions = useMemo(() => {
    if (!interactionId || !interaction) return undefined;

    return [
      ...(user && interaction.created_by === user.id ? [{
        element: (
          <VisibilityToggleButton
            entityType="interaction"
            entityId={interactionId}
            isPrivate={interaction.is_private}
            onToggled={reload}
            showToast={show}
          />
        ),
      }] : []),
      {
        icon: Pencil,
        href: `/app/interactions/${interactionId}/edit`,
      } as const,
      {
        element: (
          <InteractionAttachmentImport interactionId={interactionId} onUploaded={reload} />
        ),
      },
    ];
  }, [interaction, interactionId, reload, show, user]);

  const hasInteraction = Boolean(interaction);
  const showLoading = loading && !hasInteraction;
  const isNotFound = !showLoading && (!id || !interaction);

  return (
    <DetailPageLayout
      context={typeLabel}
      actions={layoutActions}
      loading={showLoading}
      error={error ?? null}
      errorTitle={t("interactionsloadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={Notebook}
          title={t("interactionsnotFound")}
          description={t("interactionsnewEntryIntro")}
          action={
            <Button asChild variant="outline">
              <LinkWithOverlay href="/app/interactions">{t("interactionstitle")}</LinkWithOverlay>
            </Button>
          }
        />
      }
    >
      {interaction ? (
        <InteractionDetailView
          interaction={interaction}
          documents={documents}
          previews={previews}
          fileError={fileError}
          onReload={reload}
          onDeleted={() => router.push(returnTo || "/app/interactions")}
          deleteInteraction={deleteInteraction}
        />
      ) : null}
    </DetailPageLayout>
  );
}
