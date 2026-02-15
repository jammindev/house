"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCcw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { PhotoDocument } from "@photos/types";
import { PhotoDetailsPanel } from "@photos/components/PhotoDetailsPanel";
import type { FilePreview } from "@interactions/hooks/useSignedFilePreviews";

type PhotoGridProps = {
  photos: PhotoDocument[];
  previews: Record<string, FilePreview>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function PhotoGrid({ photos, previews, loading, error, onRefresh }: PhotoGridProps) {
  const { t } = useI18n();
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const isEmpty = !loading && photos.length === 0 && !error;

  useEffect(() => {
    setOpenPhotoId((current) => {
      if (!current) return null;
      return photos.some((photo) => photo.id === current) ? current : null;
    });
  }, [photos]);

  const handleOpenChange = (photoId: string, open: boolean) => {
    setOpenPhotoId((current) => {
      if (open) return photoId;
      return current === photoId ? null : current;
    });
  };

  const renderGrid = () => (
    <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
      {photos.map((photo) => {
        const preview = previews[photo.id];
        const previewUrl = preview?.thumbnail ?? preview?.view;
        const isSelected = photo.id === openPhotoId;
        const title = photoTitle(photo.name, t("documents.untitledDocument"));
        const description = photo.notes && photo.notes.trim().length > 0 ? photo.notes : undefined;
        return (
          <SheetDialog
            key={photo.id}
            trigger={
              <button
                type="button"
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-lg border border-transparent bg-gray-50 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                  isSelected
                    ? "ring-2 ring-primary-500 border-primary-200"
                    : "hover:border-primary-200 hover:ring-1 hover:ring-primary-200/70"
                )}
                aria-pressed={isSelected}
              >
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={photo.name}
                    fill
                    sizes="(max-width: 768px) 33vw, (max-width: 1200px) 20vw, 15vw"
                    className="object-cover transition duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {title}
                </div>
              </button>
            }
            description={description}
            closeLabel={t("common.close") ?? "Close"}
            contentClassName="gap-6 p-0 sm:p-6"
            containerClassName="h-full"
            open={openPhotoId === photo.id}
            onOpenChange={(open) => handleOpenChange(photo.id, open)}
          >
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,3.5fr)_minmax(280px,1fr)] lg:items-start">
              <div className="relative min-h-[75vh] w-full overflow-hidden border border-gray-900/10 bg-gradient-to-b from-gray-900 to-black shadow-2xl lg:min-h-[65vh]">
                {preview?.view ? (
                  <Image
                    src={preview.view}
                    alt={photo.name || t("photos.previewUnavailable")}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 60vw"
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-500">
                    <ImageIcon className="h-10 w-10" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-lg shadow-gray-200/60 backdrop-blur lg:self-stretch">
                <PhotoDetailsPanel
                  photo={photo}
                  previewUrl={preview?.view}
                  downloadUrl={preview?.download}
                />
              </div>
            </div>
          </SheetDialog>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("photos.error", { message: error })}</span>
            <Button size="sm" variant="outline" onClick={() => onRefresh()}>
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("photos.refresh")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={`photo-skeleton-${index}`}
              className="aspect-square animate-pulse bg-gray-200"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-600">
          <ImageIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
          <p>{t("photos.empty")}</p>
          <Button variant="outline" size="sm" onClick={() => onRefresh()}>
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("photos.refresh")}
          </Button>
        </div>
      ) : (
        renderGrid()
      )}
    </div>
  );
}

function photoTitle(name: string | null, fallback: string) {
  return name && name.trim().length > 0 ? name : fallback;
}
