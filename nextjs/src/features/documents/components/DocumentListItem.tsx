"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2, FileX, Download, Trash2, ExternalLink, Edit } from "lucide-react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useDeleteDocument } from "@/features/interactions/hooks/useDeleteDocument";
import type { DocumentWithLinks } from "../types";
import { formatFileSize, getDocumentFileSize } from "@interactions/utils/formatFileSize";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

type Props = {
    doc: DocumentWithLinks;
    viewUrl?: string | null;
    downloadUrl?: string | null;
    onEdit?: (doc: DocumentWithLinks) => void;
    onDeleted?: () => void;
};

export default function DocumentListItem({ doc, viewUrl, downloadUrl, onEdit, onDeleted }: Props) {
    const { t } = useI18n();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const { deleteFile, loading } = useDeleteDocument();

    const fileName = doc.name || t("documents.untitledDocument");
    const fileSizeLabel = formatFileSize(getDocumentFileSize(doc as any));
    const hasPreview = Boolean(viewUrl);

    const handleDownload = useCallback(async () => {
        setDownloading(true);
        try {
            if (downloadUrl) {
                // If parent provided a presigned link just open it
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.click();
            } else {
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();
                const { data, error: signedError } = await client.storage.from("files").createSignedUrl(doc.file_path, 120);
                if (signedError || !data?.signedUrl) throw signedError ?? new Error("missing signed url");
                const a = document.createElement("a");
                a.href = data.signedUrl;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.click();
            }
        } catch (err) {
            console.error(err);
            // best-effort: parent will show errors via onRefresh cycle if needed
        } finally {
            setDownloading(false);
        }
    }, [downloadUrl, doc.file_path]);

    const handleConfirmDelete = useCallback(async () => {
        try {
            await deleteFile({ id: doc.id, file_path: doc.file_path, interaction_id: undefined });
            setConfirmOpen(false);
            onDeleted?.();
        } catch (e) {
            console.error(e);
        }
    }, [deleteFile, doc.id, doc.file_path, onDeleted]);

    return (
        <li
            role="listitem"
            className="space-y-2 border-gray-200 rounded-md bg-white px-3 py-2 transition-shadow hover:shadow-sm w-full overflow-hidden"
        >
            <div className="flex items-center gap-3">
                {/* Name + icon */}
                {hasPreview ? (
                    <a
                        href={viewUrl as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("common.open")} ${fileName}`}
                        className="flex items-center gap-3 w-0 flex-1 overflow-hidden group hover:bg-gray-50 rounded px-1 py-1 transition-colors"
                    >
                        <div className="flex-shrink-0">
                            {false ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            ) : (
                                <FileText className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                            )}
                        </div>

                        <div className="w-0 flex-1 overflow-hidden">
                            <div className="truncate text-sm text-gray-900 group-hover:text-gray-700">
                                <span className="font-medium">{fileName}</span>
                                {fileSizeLabel && <span className="ml-2 text-xs text-gray-500">({fileSizeLabel})</span>}
                            </div>
                        </div>
                    </a>
                ) : (
                    <div className="flex items-center gap-3 w-0 flex-1 overflow-hidden">
                        <div className="flex-shrink-0">
                            <FileX className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="w-0 flex-1 overflow-hidden">
                            <div className="truncate text-sm text-gray-900">
                                <span className="font-medium">{fileName}</span>
                                {fileSizeLabel && <span className="ml-2 text-xs text-gray-500">({fileSizeLabel})</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.preventDefault(); void handleDownload(); }}>
                        <a aria-label={`${t("common.download")} ${fileName}`}>
                            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </a>
                    </Button>

                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`${t("documents.edit")}`} onClick={() => onEdit?.(doc)}>
                        <Edit className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700"
                        aria-label={`${t("common.delete")} ${fileName}`}
                        onClick={() => setConfirmOpen(true)}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {confirmOpen && (
                    <ConfirmDialog
                        open={confirmOpen}
                        onOpenChange={setConfirmOpen}
                        title={t("interactionsdeleteFileTitle")}
                        confirmText={t("common.delete")}
                        onConfirm={handleConfirmDelete}
                        loading={loading}
                        destructive
                    />
                )}
            </div>
            {/* Linked interactions / meta */}
            <div className="flex-1 w-full mt-2 sm:mt-0 sm:flex-none sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                    {doc.links.length ? (
                        doc.links.map((link) => (
                            <LinkWithOverlay
                                key={link.interactionId}
                                href={`/app/interactions/${link.interactionId}`}
                                className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700 transition hover:border-primary-300 hover:bg-primary-100"
                            >
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                {link.subject || t("documents.interactionNoSubject")}
                            </LinkWithOverlay>
                        ))
                    ) : (
                        <span className="text-xs text-gray-500">{t("documents.noLinkedInteractions")}</span>
                    )}
                </div>
            </div>
        </li>
    );
}
