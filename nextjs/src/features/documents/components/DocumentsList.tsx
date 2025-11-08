// nextjs/src/features/documents/components/DocumentsList.tsx
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertCircle, Edit, ExternalLink, FileDown, Loader2, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DocumentWithLinks } from "../types";
import { useDeleteDocument } from "@/features/interactions/hooks/useDeleteDocument";
import { EditDocumentModal } from "./EditDocumentModal";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSize(metadata: DocumentWithLinks["metadata"]) {
  const sizeValue =
    metadata && typeof metadata === "object" && "size" in metadata
      ? Number((metadata as { size: unknown }).size)
      : NaN;
  if (!Number.isFinite(sizeValue) || sizeValue <= 0) return "";
  if (sizeValue < 1024) return `${sizeValue} B`;
  if (sizeValue < 1024 * 1024) return `${(sizeValue / 1024).toFixed(1)} KB`;
  if (sizeValue < 1024 * 1024 * 1024) return `${(sizeValue / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeValue / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type DocumentsListProps = {
  documents: DocumentWithLinks[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  filterActive: boolean;
  highlightedIds?: string[];
};

export function DocumentsList({ documents, loading, error, onRefresh, filterActive, highlightedIds = [] }: DocumentsListProps) {
  const { t } = useI18n();
  const { deleteFile } = useDeleteDocument();
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentWithLinks | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const emptyMessage = useMemo(() => {
    if (filterActive) {
      return t("documents.noneFiltered");
    }
    return t("documents.none");
  }, [filterActive, t]);

  const handleDownload = useCallback(
    async (doc: DocumentWithLinks) => {
      setActionError(null);
      setDownloadingId(doc.id);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error: signedError } = await client.storage.from("files").createSignedUrl(doc.file_path, 120);
        if (signedError || !data?.signedUrl) {
          throw signedError ?? new Error("missing signed url");
        }
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      } catch (downloadError: unknown) {
        console.error(downloadError);
        setActionError(t("documents.downloadFailed"));
      } finally {
        setDownloadingId(null);
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    async (doc: DocumentWithLinks) => {
      setActionError(null);
      const confirmed = window.confirm(t("documents.confirmDelete", { name: doc.name }));
      if (!confirmed) return;

      setDeletingId(doc.id);
      try {
        await deleteFile({
          id: doc.id,
          file_path: doc.file_path,
          interaction_id: undefined,
        });
        await onRefresh();
      } catch (deleteError: unknown) {
        console.error(deleteError);
        setActionError(t("documents.deleteFailed"));
      } finally {
        setDeletingId(null);
      }
    },
    [deleteFile, onRefresh, t]
  );

  const handleEdit = useCallback((doc: DocumentWithLinks) => {
    setEditingDocument(doc);
    setIsEditModalOpen(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="space-y-4">
      {(error || actionError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error ?? actionError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("documents.loading")}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => {
            const docSize = formatSize(doc.metadata);
            const isHighlighted = highlightedIds.includes(doc.id);
            return (
              <li
                key={doc.id}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/60",
                  isHighlighted && "border-primary-300 bg-primary-50"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-medium text-gray-900">
                      {doc.name || t("documents.untitledDocument")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t(`storage.type.${doc.type}` as const)} · {formatDate(doc.created_at)}
                      {docSize ? ` · ${docSize}` : ""}
                    </p>
                    {doc.notes && doc.notes.trim() ? (
                      <p className="text-xs text-gray-600">{doc.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownload(doc)}
                      disabled={downloadingId === doc.id || deletingId === doc.id}
                    >
                      {downloadingId === doc.id ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {t("documents.downloading")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <FileDown className="h-4 w-4" aria-hidden="true" />
                          {t("documents.download")}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(doc)}
                      disabled={downloadingId === doc.id || deletingId === doc.id}
                    >
                      <span className="flex items-center gap-2">
                        <Edit className="h-4 w-4" aria-hidden="true" />
                        {t("documents.edit")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(doc)}
                      disabled={deletingId === doc.id || downloadingId === doc.id}
                      className={cn(
                        "text-red-600 hover:text-red-700",
                        deletingId === doc.id && "cursor-wait opacity-70"
                      )}
                    >
                      {deletingId === doc.id ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {t("documents.deleting")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          {t("documents.delete")}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {doc.links.length ? (
                    doc.links.map((link) => (
                      <Link
                        key={link.interactionId}
                        href={`/app/interactions/${link.interactionId}`}
                        className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700 transition hover:border-primary-300 hover:bg-primary-100"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        {link.subject ? link.subject : t("documents.interactionNoSubject")}
                      </Link>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">{t("documents.noLinkedInteractions")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditDocumentModal
        document={editingDocument}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
