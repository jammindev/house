// nextjs/src/features/interactions/components/pdf/PdfFileItem.tsx
"use client";

import { FileText, Loader2, FileX, Download, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useDeleteDocument } from "@interactions/hooks/useDeleteDocument";
import type { Document } from "@interactions/types";
import { getInteractionFileName } from "@interactions/utils/getInteractionFileName";
import { formatFileSize, getDocumentFileSize } from "@interactions/utils/formatFileSize";

interface PdfFileItemProps {
    file: Document;
    viewUrl?: string;
    downloadUrl?: string;
    onDeleted?: () => void;
}

export default function PdfFileItem({ file, viewUrl, downloadUrl, onDeleted }: PdfFileItemProps) {
    const { t } = useI18n();
    const { user } = useGlobal();
    const canDelete = useMemo(() => !!user?.id && !!file.created_by && user.id === file.created_by, [user?.id, file.created_by]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { deleteFile, loading } = useDeleteDocument();
    const fileName = getInteractionFileName(file) || t("common.file");
    const isLoading = !viewUrl;
    const fileSizeLabel = formatFileSize(getDocumentFileSize(file));

    return (
        <li
            role="listitem"
            className="flex items-center gap-3 border border-gray-200 rounded-md bg-white px-3 py-2 transition-shadow hover:shadow-sm w-full overflow-hidden"
        >
            {/* Icône + Nom cliquable */}
            {viewUrl ? (
                <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t("common.open")} ${fileName}`}
                    className="flex items-center gap-3 w-0 flex-1 overflow-hidden group hover:bg-gray-50 rounded px-1 py-1 transition-colors"
                >
                    {/* Icône */}
                    <div className="flex-shrink-0">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : (
                            <FileText className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                        )}
                    </div>

                    {/* Nom du fichier + taille sur une ligne */}
                    <div className="w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm text-gray-900 group-hover:text-gray-700">
                            <span className="font-medium">{fileName}</span>
                            {fileSizeLabel && (
                                <span className="ml-2 text-xs text-gray-500">({fileSizeLabel})</span>
                            )}
                        </div>
                    </div>
                </a>
            ) : (
                <div className="flex items-center gap-3 w-0 flex-1 overflow-hidden">
                    {/* Icône non cliquable */}
                    <div className="flex-shrink-0">
                        <FileX className="h-4 w-4 text-gray-400" />
                    </div>

                    {/* Nom du fichier + taille */}
                    <div className="w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm text-gray-900">
                            <span className="font-medium">{fileName}</span>
                            {fileSizeLabel && (
                                <span className="ml-2 text-xs text-gray-500">({fileSizeLabel})</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions compactes */}
            {viewUrl ? (
                <div className="flex items-center gap-1 shrink-0">
                    {/* Bouton télécharger */}
                    {downloadUrl && (
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                            <a
                                href={downloadUrl}
                                aria-label={`${t("common.download")} ${fileName}`}
                            >
                                <Download className="w-3.5 h-3.5" />
                            </a>
                        </Button>
                    )}

                    {/* Bouton supprimer */}
                    {canDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700"
                            aria-label={`${t("common.delete")} ${fileName}`}
                            onClick={() => setConfirmOpen(true)}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            ) : (
                <span className="text-xs text-gray-500 shrink-0">{t("common.previewUnavailable")}</span>
            )}

            {/* Dialog de confirmation */}
            {canDelete && (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title={t("interactionsdeleteFileTitle")}
                    confirmText={t("common.delete")}
                    onConfirm={async () => {
                        await deleteFile({
                            id: file.id,
                            file_path: file.file_path,
                            interaction_id: file.interaction_id,
                        });
                        setConfirmOpen(false);
                        onDeleted?.();
                    }}
                    loading={loading}
                    destructive
                />
            )}
        </li>
    );
}
