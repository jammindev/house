// nextjs/src/features/documents/hooks/useDocuments.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { DocumentWithLinks, SupabaseDocumentRow } from "@documents/types";
import { normalizeDocuments } from "@documents/utils/normalizeDocuments";

export function useDocuments() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const [documents, setDocuments] = useState<DocumentWithLinks[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!householdId) {
      setDocuments([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data, error: supabaseError } = await client
        .from("documents")
        .select(
          `
            id,
            household_id,
            file_path,
            name,
            notes,
            mime_type,
            type,
            metadata,
            created_at,
            created_by,
            interaction_documents (
              interaction_id,
              interaction:interactions (
                id,
                subject
              )
            )
          `
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;

      const normalized: DocumentWithLinks[] = normalizeDocuments(data as SupabaseDocumentRow[] | null);

      setDocuments(normalized);
    } catch (fetchError: unknown) {
      console.error(fetchError);
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load documents";
      setError(message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const unlinkedDocuments = useMemo(
    () => documents.filter((doc) => doc.links.length === 0),
    [documents]
  );

  return {
    documents,
    loading,
    error,
    refresh: fetchDocuments,
    unlinkedCount: unlinkedDocuments.length,
  };
}
