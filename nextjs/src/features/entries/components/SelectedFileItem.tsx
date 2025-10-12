// nextjs/src/features/entries/components/SelectedFileItem.tsx
"use client";
import Image from "next/image";
import { FileText, File as FileIcon, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EntryFileType } from "@entries/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ChangeEvent } from "react";
import clsx from "clsx";

type Props = {
    index: number;
    file: File;
    type: EntryFileType;
    customName: string;
    fileTypeLabel: string;
    onCustomNameChange: (index: number, value: string) => void;
    onFileTypeChange: (index: number, type: EntryFileType) => void;
    onRemove: (index: number) => void;
};

export default function SelectedFileItem({
    index,
    file,
    type,
    customName,
    fileTypeLabel,
    onCustomNameChange,
    onFileTypeChange,
    onRemove,
}: Props) {
    const { t } = useI18n();
    const selectId = `selected-file-type-${index}`;
    const isImage = file.type?.startsWith("image/") ?? false;
    const isPDF = file.type === "application/pdf";

    const handleNameChange = (event: ChangeEvent<HTMLInputElement>) =>
        onCustomNameChange(index, event.target.value);

    const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) =>
        onFileTypeChange(index, event.target.value as EntryFileType);

    const imagePreview = isImage ? URL.createObjectURL(file) : null;

    return (
        <li
            className="
                flex flex-col sm:flex-row sm:items-center sm:justify-between
                gap-3 rounded-lg border border-gray-200 bg-white/60 p-3
                shadow-sm hover:bg-gray-50 transition-colors
            "
        >
            {/* --- Vignette + Nom --- */}
            <div className="flex items-center gap-3 w-full sm:w-2/3">
                {/* Vignette fichier */}
                <div
                    className={clsx(
                        "relative flex-shrink-0 w-12 h-12 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden",
                        { "p-1": isImage }
                    )}
                >
                    {isImage ? (
                        <Image
                            src={imagePreview!}
                            alt={file.name}
                            fill
                            className="object-cover rounded-md"
                            sizes="48px"
                        />
                    ) : isPDF ? (
                        <FileText className="w-6 h-6 text-red-500" />
                    ) : (
                        <FileIcon className="w-6 h-6 text-gray-500" />
                    )}
                </div>

                {/* Nom du fichier */}
                <div className="flex-1 min-w-0">
                    <label htmlFor={`custom-file-name-${index}`} className="sr-only">
                        {t("entries.customFileNameLabel")}
                    </label>
                    <Input
                        id={`custom-file-name-${index}`}
                        value={customName}
                        onChange={handleNameChange}
                        className="h-8 text-xs sm:text-sm"
                        placeholder={file.name}
                    />
                    <p className="mt-1 truncate text-[11px] text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB — {file.type || "inconnu"}
                    </p>
                </div>
            </div>

            {/* --- Type + Supprimer --- */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:w-auto">
                <div className="relative">
                    <label htmlFor={selectId} className="sr-only">
                        {fileTypeLabel}
                    </label>
                    <select
                        id={selectId}
                        value={type}
                        onChange={handleTypeChange}
                        disabled={!isImage} // PDF ou document -> lecture seule
                        title={!isImage ? t("common.readOnly") : undefined}
                        className={clsx(
                            "rounded-md border border-gray-300 bg-white px-2 py-[6px] text-xs sm:text-sm text-gray-700 h-8 sm:h-9",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500",
                            // Supprime le style grisé natif du select désactivé
                            !isImage && "opacity-100 cursor-default text-gray-600"
                        )}
                    >
                        <option value="photo">{t("entries.fileType.photo")}</option>
                        <option value="document">{t("entries.fileType.document")}</option>
                    </select>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="text-gray-500 hover:text-red-600"
                    aria-label={t("common.delete")}
                >
                    <Trash className="w-4 h-4" />
                </Button>
            </div>
        </li>
    );
}