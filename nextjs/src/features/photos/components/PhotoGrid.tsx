"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, RefreshCcw, X } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PhotoDocument } from "@photos/types";
import { PhotoDetailsPanel } from "@photos/components/PhotoDetailsPanel";

type PhotoGridProps = {
  photos: PhotoDocument[];
  previews: Record<string, { view: string; download: string }>;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function PhotoGrid({ photos, previews, loading, error, onRefresh }: PhotoGridProps) {
  const { t } = useI18n();
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isEmpty = !loading && photos.length === 0 && !error;

  useEffect(() => {
    setActivePhotoId((current) => {
      if (!current) return null;
      return photos.some((photo) => photo.id === current) ? current : null;
    });
  }, [photos]);

  const activePhoto = useMemo(
    () => (activePhotoId ? photos.find((photo) => photo.id === activePhotoId) ?? null : null),
    [photos, activePhotoId]
  );

  const activePreview = activePhoto ? previews[activePhoto.id] : undefined;
  const isDialogOpen = isModalOpen && Boolean(activePhoto);

  const handleSelect = (photoId: string) => {
    setActivePhotoId(photoId);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setActivePhotoId(null);
  };

  const renderGrid = () => (
    <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
      {photos.map((photo) => {
        const previewUrl = previews[photo.id]?.view;
        const isSelected = photo.id === activePhotoId;
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => handleSelect(photo.id)}
            className={`relative aspect-square overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
              isSelected ? "ring-2 ring-primary-500" : ""
            }`}
            aria-pressed={isSelected}
          >
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={photo.name}
                fill
                sizes="(max-width: 768px) 33vw, (max-width: 1200px) 20vw, 15vw"
                className="object-cover transition duration-200 hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
          </button>
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
        <>
          {renderGrid()}

          <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : handleClose())}>
            {activePhoto ? (
              <DialogContent
                hideDefaultCloseButton
                className="w-[96vw] max-w-5xl border-none bg-transparent p-0 shadow-none"
              >
                <VisuallyHidden>
                  <p>{photoTitle(activePhoto.name, t("documents.untitledDocument"))}</p>
                </VisuallyHidden>
                <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl lg:flex-row">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    aria-label={t("common.close") ?? "Close"}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="relative flex-1 bg-black">
                    {activePreview?.view ? (
                      <Image
                        src={activePreview.view}
                        alt={activePhoto.name || t("photos.previewUnavailable")}
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-500">
                        <ImageIcon className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="w-full max-h-[88vh] overflow-y-auto border-t border-gray-200 p-6 lg:w-1/3 lg:border-l lg:border-t-0">
                    <PhotoDetailsPanel
                      photo={activePhoto}
                      previewUrl={activePreview?.view}
                      downloadUrl={activePreview?.download}
                    />
                  </div>
                </div>
              </DialogContent>
            ) : null}
          </Dialog>
        </>
      )}
    </div>
  );
}

function photoTitle(name: string | null, fallback: string) {
  return name && name.trim().length > 0 ? name : fallback;
}
