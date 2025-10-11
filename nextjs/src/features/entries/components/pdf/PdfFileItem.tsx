"use client";

import { FileText, Loader2, FileX, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EntryFile } from "@entries/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface PdfFileItemProps {
    file: EntryFile;
    viewUrl?: string;
    downloadUrl?: string;
}

export default function PdfFileItem({ file, viewUrl, downloadUrl }: PdfFileItemProps) {
    const { t } = useI18n()
    const fileName = file.storage_path.split("/").pop() || t("common.file");
    const isLoading = !viewUrl;
    return (
        <li
            role="listitem"
            className="flex items-center justify-between gap-3 border border-gray-200 rounded-md bg-white p-3 transition-shadow hover:shadow-sm w-full"
        >
            <div className="flex items-center gap-2 min-w-0">
                {/* Icône / statut */}
                <div className="h-12 w-12 flex shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50">
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : viewUrl ? (
                        <FileText className="h-5 w-5 text-red-500" />
                    ) : (
                        <FileX className="h-5 w-5 text-gray-400" />
                    )}
                </div>


                {/* Détails */}
                <span className="truncate text-sm font-medium text-gray-800">{fileName + "c'est ivuebviurbv. eurvber uivb b erçuvbe çrvberv"}</span>
            </div>

            {/* Actions */}
            {viewUrl ? (
                <div className="flex items-center gap-2 shrink-0">
                    {/* Bouton ouvrir */}
                    <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
                        <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t("common.open")} ${fileName}`}
                        >
                            {t("common.open")}
                        </a>
                    </Button>

                    {/* Bouton télécharger */}
                    {downloadUrl && (
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <a
                                href={downloadUrl}
                                aria-label={`${t("common.download")} ${fileName}`}
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        </Button>
                    )}
                </div>
            ) : (
                <span className="text-xs text-gray-400">{t("common.previewUnavailable")}</span>
            )}
        </li>
    );
}
