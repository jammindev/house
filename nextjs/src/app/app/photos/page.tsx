"use client";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PhotoGrid } from "@photos/components/PhotoGrid";
import { usePhotoDocuments } from "@photos/hooks/usePhotoDocuments";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";

export default function PhotosPage() {
  const { t } = useI18n();
  const { photos, loading, error, refresh } = usePhotoDocuments();
  const { previews, error: previewError } = useSignedFilePreviews(photos);

  const combinedError = error ?? (previewError || null);

  return (
    <AppPageLayout title={t("photos.title")} subtitle={t("photos.subtitle")} hideBackButton>
      <PhotoGrid
        photos={photos}
        previews={previews}
        loading={loading}
        error={combinedError}
        onRefresh={refresh}
      />
    </AppPageLayout>
  );
}
