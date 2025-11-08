// nextjs/src/features/documents/components/DesktopUploadInterface.tsx
"use client";

import { useRef, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { cn } from "@/lib/utils";

type DesktopUploadInterfaceProps = {
    onFilesSelected: (files: FileList) => void;
    disabled?: boolean;
};

export function DesktopUploadInterface({ onFilesSelected, disabled = false }: DesktopUploadInterfaceProps) {
    const { t } = useI18n();
    const { loading: globalLoading } = useGlobal();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const isDisabled = disabled || globalLoading;

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            onFilesSelected(event.target.files);
            event.target.value = "";
        }
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer?.files?.length) {
            onFilesSelected(event.dataTransfer.files);
        }
    };

    const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <label
            htmlFor="documents-file-input"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center transition cursor-pointer",
                "hover:border-primary-300 hover:bg-primary-50/50",
                isDisabled && "pointer-events-none opacity-60"
            )}
        >
            <UploadCloud className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
                <p className="text-base font-medium text-gray-900">{t("storage.dropLabel")}</p>
                <p className="text-sm text-gray-500">{t("storage.dropHelper")}</p>
            </div>
            <Input
                ref={fileInputRef}
                id="documents-file-input"
                type="file"
                multiple
                className="sr-only"
                onChange={handleInputChange}
                disabled={isDisabled}
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                }}
                disabled={isDisabled}
            >
                {t("storage.chooseFiles")}
            </Button>
        </label>
    );
}