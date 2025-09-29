"use client";

import type { ChangeEvent } from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

type DocumentImportButtonsProps = {
  onFilesSelected: (files: File[]) => void;
};

export function DocumentImportButtons({ onFilesSelected }: DocumentImportButtonsProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const selectedFiles = Array.from(event.target.files);
    onFilesSelected(selectedFiles);
    event.target.value = "";
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => cameraInputRef.current?.click()}
          className="shrink-0"
        >
          {t("entries.capturePhoto")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0"
        >
          {t("entries.selectFiles")}
        </Button>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesChange}
        className="hidden"
      />
    </>
  );
}
