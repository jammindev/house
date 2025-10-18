// nextjs/src/app/app/interactions/[id]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionDetailView from "@interactions/components/InteractionDetailView";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import { useInteraction } from "@interactions/hooks/useInteraction";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { interaction, documents, loading, error, reload } = useInteraction(id);
  const { previews, error: fileError } = useSignedFilePreviews(documents);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!interaction) return <div className="p-6 text-gray-500">{t("interactionsnotFound")}</div>;

  return (
    <InteractionDetailView
      interaction={interaction}
      documents={documents}
      previews={previews}
      fileError={fileError}
      onReload={reload}
      onDeleted={() => router.push("/app/interactions")}
    />
  );
}
