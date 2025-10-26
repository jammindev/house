"use client";

import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document, DocumentType } from "@interactions/types";

type ExistingDocumentsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId?: string | null;
  interactionId?: string;
  onConfirm: (documents: Document[]) => Promise<void> | void;
  allowedTypes?: DocumentType[];
  excludeDocumentIds?: string[];
};

type DocumentRow = {
  id: string;
  household_id: string;
  file_path: string;
  mime_type: string | null;
  type: DocumentType | null;
  name: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
};

export default function ExistingDocumentsModal({
  open,
  onOpenChange,
  householdId,
  interactionId,
  onConfirm,
  allowedTypes,
  excludeDocumentIds,
}: ExistingDocumentsModalProps) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allowedTypesKey = useMemo(() => (allowedTypes && allowedTypes.length ? allowedTypes.join(",") : ""), [allowedTypes]);
  const excludeIdsKey = useMemo(() => (excludeDocumentIds && excludeDocumentIds.length ? excludeDocumentIds.join(",") : ""), [excludeDocumentIds]);
  const excludedIds = useMemo(() => {
    if (!excludeIdsKey) return new Set<string>();
    return new Set(excludeIdsKey.split(",").filter(Boolean));
  }, [excludeIdsKey]);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      return;
    }

    if (!householdId) {
      setDocuments([]);
      return;
    }

    let cancelled = false;
    const loadDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        let query = client
          .from("documents")
          .select("id, household_id, file_path, mime_type, type, name, notes, metadata, created_at, created_by")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false });

        const allowedFilterList = allowedTypesKey
          ? (allowedTypesKey.split(",").filter(Boolean) as DocumentType[])
          : null;
        if (allowedFilterList && allowedFilterList.length > 0) {
          query = query.in("type", allowedFilterList);
        }

        query = query.limit(100);

        const { data, error: docsError } = await query;
        if (docsError) throw docsError;

        let rows = (data ?? []) as DocumentRow[];

        if (interactionId) {
          const { data: linkedData, error: linkedError } = await client
            .from("interaction_documents")
            .select("document_id")
            .eq("interaction_id", interactionId);
          if (linkedError) throw linkedError;
          const linkedIds = new Set((linkedData ?? []).map((row) => row.document_id));
          rows = rows.filter((row) => !linkedIds.has(row.id));
        }

        if (cancelled) return;

        const mapped = rows.map<Document>((row) => ({
          id: row.id,
          household_id: row.household_id,
          file_path: row.file_path,
          name: row.name ?? "",
          notes: row.notes ?? "",
          mime_type: row.mime_type ?? null,
          type: (row.type ?? "document") as DocumentType,
          metadata: row.metadata ?? null,
          created_at: row.created_at,
          created_by: row.created_by ?? null,
          interaction_id: undefined,
          link_role: null,
          link_note: null,
          link_created_at: null,
        }));
        setDocuments(mapped);
      } catch (loadError: unknown) {
        console.error(loadError);
        if (cancelled) return;
        const message =
          loadError instanceof Error ? loadError.message : t("storage.recentLoadFailed");
        setError(message);
        setDocuments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [allowedTypesKey, householdId, interactionId, open, t]);

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      next.forEach((id) => {
        if (excludedIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [excludedIds]);

  const filteredDocuments = useMemo(() => {
    const base = documents.filter((doc) => !excludedIds.has(doc.id));
    if (!search.trim()) return base;
    const lower = search.toLowerCase();
    return base.filter((doc) => doc.name.toLowerCase().includes(lower));
  }, [documents, excludedIds, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    const selectedDocs = documents.filter((doc) => selectedIds.has(doc.id));
    if (!selectedDocs.length) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm(selectedDocs);
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (confirmError: unknown) {
      console.error(confirmError);
      const message =
        confirmError instanceof Error ? confirmError.message : t("storage.quickUploadFailed");
      setError(message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("interactions.linkExistingDocuments") ?? "Associer des documents existants"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder={t("interactions.searchDocumentsPlaceholder") ?? "Rechercher…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={loading}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : filteredDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("interactions.noDocumentsAvailable") ?? "Aucun document disponible."}
              </p>
            ) : (
              filteredDocuments.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleSelection(doc.id)}
                    className={`w-full text-left border rounded-lg p-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {t(`interactionstypes.${doc.type}`, { defaultValue: doc.type })}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirming || selectedIds.size === 0}
            >
              {confirming ? t("common.saving") : t("interactions.linkSelectedDocuments") ?? "Associer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
