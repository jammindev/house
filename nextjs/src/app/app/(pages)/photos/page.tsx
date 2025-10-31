"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PhotoGrid } from "@photos/components/PhotoGrid";
import { usePhotoDocuments } from "@photos/hooks/usePhotoDocuments";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function PhotosPage() {
  const { t } = useI18n();
  const { photos, loading, error, refresh } = usePhotoDocuments();
  const { previews, error: previewError } = useSignedFilePreviews(photos);
  const setPageLayoutConfig = usePageLayoutConfig();

  const combinedError = error ?? (previewError || null);

  useEffect(() => {
    setPageLayoutConfig({
      title: t("photos.title"),
      subtitle: t("photos.subtitle"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      hideBackButton: true,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
    <PhotoGrid
      photos={photos}
      previews={previews}
      loading={loading}
      error={combinedError}
      onRefresh={refresh}
    />
  );
}
