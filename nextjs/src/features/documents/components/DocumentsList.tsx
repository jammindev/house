// nextjs/src/features/documents/components/DocumentsList.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { DocumentWithLinks } from "../types";
import DocumentListItem from "./DocumentListItem";
import { EditDocumentModal } from "./EditDocumentModal";

type DocumentUrls = {
  viewUrl: string | null;
  downloadUrl: string | null;
};

type DocumentsListProps = {
  documents: DocumentWithLinks[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  filterActive: boolean;
  highlightedIds?: string[];
  readonly?: boolean; // New prop to disable editing/deleting
};

export function DocumentsList({ documents, loading, error, onRefresh, filterActive, highlightedIds = [], readonly = false }: DocumentsListProps) {
  const { t } = useI18n();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentWithLinks | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, DocumentUrls>>({});
  const [urlsLoading, setUrlsLoading] = useState(false);

  const emptyMessage = useMemo(() => {
    if (filterActive) {
      return t("documents.noneFiltered");
    }
    return t("documents.none");
  }, [filterActive, t]);

  // Generate signed URLs for all documents
  const generateSignedUrls = useCallback(async () => {
    if (documents.length === 0) return;

    setUrlsLoading(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const urlPromises = documents.map(async (doc) => {
        try {
          const { data, error } = await client.storage
            .from("files")
            .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

          if (error || !data?.signedUrl) {
            console.warn(`Failed to generate signed URL for ${doc.file_path}:`, error);
            return { id: doc.id, viewUrl: null, downloadUrl: null };
          }

          return {
            id: doc.id,
            viewUrl: data.signedUrl,
            downloadUrl: data.signedUrl,
          };
        } catch (err) {
          console.warn(`Error generating URLs for document ${doc.id}:`, err);
          return { id: doc.id, viewUrl: null, downloadUrl: null };
        }
      });

      const urlResults = await Promise.all(urlPromises);
      const urlMap = urlResults.reduce((acc, result) => {
        acc[result.id] = {
          viewUrl: result.viewUrl,
          downloadUrl: result.downloadUrl,
        };
        return acc;
      }, {} as Record<string, DocumentUrls>);

      setDocumentUrls(urlMap);
    } catch (error) {
      console.error("Failed to generate signed URLs for documents:", error);
    } finally {
      setUrlsLoading(false);
    }
  }, [documents]);

  useEffect(() => {
    void generateSignedUrls();
  }, [generateSignedUrls]);

  const handleEdit = useCallback((doc: DocumentWithLinks) => {
    if (readonly) return;
    setEditingDocument(doc);
    setIsEditModalOpen(true);
  }, [readonly]);

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
            const urls = documentUrls[doc.id] || { viewUrl: null, downloadUrl: null };
            return (
              <div key={doc.id} className={cn(isHighlighted && "border-primary-300 bg-primary-50")}>
                <DocumentListItem
                  doc={doc}
                  viewUrl={urls.viewUrl}
                  downloadUrl={urls.downloadUrl}
                  onEdit={readonly ? undefined : (d) => handleEdit(d)}
                  onDeleted={readonly ? undefined : () => onRefresh()}
                />
              </div>
            );
          })}
        </ul>
      )}

      {!readonly && (
        <EditDocumentModal
          document={editingDocument}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
