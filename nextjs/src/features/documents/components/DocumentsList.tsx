// nextjs/src/features/documents/components/DocumentsList.tsx
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertCircle, Edit, ExternalLink, FileDown, Loader2, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { DocumentWithLinks } from "../types";
import DocumentListItem from "./DocumentListItem";
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
            const isHighlighted = highlightedIds.includes(doc.id);
            return (
              <div key={doc.id} className={cn(isHighlighted && "border-primary-300 bg-primary-50")}>
                <DocumentListItem
                  doc={doc}
                  onEdit={(d) => handleEdit(d)}
                  onDeleted={() => onRefresh()}
                />
              </div>
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
