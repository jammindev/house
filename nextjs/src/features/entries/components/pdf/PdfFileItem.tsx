"use client";

import { FileText, Loader2, FileX, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EntryFile } from "@entries/types";
import { getEntryFileName } from "@entries/utils/getEntryFileName";
import { formatFileSize, getEntryFileSize } from "@entries/utils/formatFileSize";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteEntryFile } from "@entries/hooks/useDeleteEntryFile";
import { useState, useMemo } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";

interface PdfFileItemProps {
    file: EntryFile;
    viewUrl?: string;
    downloadUrl?: string;
    onDeleted?: () => void;
}

export default function PdfFileItem({ file, viewUrl, downloadUrl, onDeleted }: PdfFileItemProps) {
    const { t } = useI18n()
    const { user } = useGlobal();
    const canDelete = useMemo(() => !!user?.id && !!file.created_by && user.id === file.created_by, [user?.id, file.created_by]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { deleteFile, loading, error } = useDeleteEntryFile();
    const fileName = getEntryFileName(file) || t("common.file");
    const isLoading = !viewUrl;
    const fileSizeLabel = formatFileSize(getEntryFileSize(file));
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
                <span className="truncate text-sm font-medium text-gray-800">
                    {fileName}
                    {fileSizeLabel && (
                        <span className="ml-2 text-xs font-medium text-gray-500">{fileSizeLabel}</span>
                    )}
                </span>
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

                    {/* Bouton supprimer */}
                    {canDelete && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                aria-label={`${t("common.delete")} ${fileName}`}
                                onClick={() => setConfirmOpen(true)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            <ConfirmDialog
                                open={confirmOpen}
                                onOpenChange={setConfirmOpen}
                                title={t("entries.deleteFileTitle")}
                                confirmText={t("common.delete")}
                                onConfirm={async () => {
                                    await deleteFile({ id: file.id, storage_path: file.storage_path });
                                    setConfirmOpen(false);
                                    onDeleted?.();
                                }}
                                loading={loading}
                                destructive
                            />
                        </>
                    )}
                </div>
            ) : (
                <span className="text-xs text-gray-400">{t("common.previewUnavailable")}</span>
            )}
        </li>
    );
}
