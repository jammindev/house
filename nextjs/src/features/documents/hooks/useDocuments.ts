"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document } from "@interactions/types";

export type DocumentLink = {
  interactionId: string;
  subject: string | null;
};

export type DocumentWithLinks = Document & {
  links: DocumentLink[];
};

type SupabaseInteractionLink = {
  interaction_id: string;
  interaction?: {
    id: string;
    subject: string | null;
  } | null;
};

type SupabaseDocumentRow = Document & {
  interaction_documents?: SupabaseInteractionLink[] | null;
};

export function useDocuments(householdId: string | null) {
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

      const normalized: DocumentWithLinks[] = (data as SupabaseDocumentRow[] | null)?.map((row) => {
        const linksRaw = row.interaction_documents ?? [];
        const links: DocumentLink[] = linksRaw.map((link) => ({
          interactionId: link.interaction_id,
          subject: link.interaction?.subject ?? null,
        }));
        return {
          ...row,
          links,
        };
      }) ?? [];

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
