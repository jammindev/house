"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { PhotoGrid } from "@photos/components/PhotoGrid";
import { usePhotoDocuments } from "@photos/hooks/usePhotoDocuments";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";

export default function PhotosPage() {
  const { t } = useI18n();
  const { photos, loading, error, refresh } = usePhotoDocuments();
  const { previews, error: previewError } = useSignedFilePreviews(photos);

  const combinedError = error ?? (previewError || null);

  return (
    <ResourcePageShell
      title={t("photos.title")}
      hideBackButton
      bodyClassName="space-y-4"
    >
      <PhotoGrid photos={photos} previews={previews} loading={loading} error={combinedError} onRefresh={refresh} />
    </ResourcePageShell>
  );
}
