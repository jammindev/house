"use client";

import { useCallback, useEffect, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document } from "@interactions/types";

type RawProjectDocument = {
  project_id: string;
  document_id: string;
  role: string;
  note: string;
  created_at: string;
  created_by: string | null;
  document: {
    id: string;
    household_id: string;
    file_path: string;
    mime_type: string | null;
    type: Document["type"];
    metadata: Document["metadata"];
    name: string;
    notes: string;
    created_by: string | null;
    created_at: string;
  } | null;
};

export function useProjectDocuments(projectId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !householdId) return;
    setLoading(true);
    setError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: projectDocumentRows, error: projectDocError } = await client
        .from("project_documents")
        .select(
          `
            project_id,
            document_id,
            role,
            note,
            created_at,
            created_by,
            document:documents(
              id,
              household_id,
              file_path,
              mime_type,
              type,
              metadata,
              name,
              notes,
              created_by,
              created_at
            )
          `
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (projectDocError) throw projectDocError;

      const rawDocuments = (projectDocumentRows ?? []) as RawProjectDocument[];
      
      const normalizedDocuments: Document[] = rawDocuments
        .filter((item) => item.document !== null)
        .map((item) => ({
          id: item.document!.id,
          household_id: item.document!.household_id,
          file_path: item.document!.file_path,
          mime_type: item.document!.mime_type ?? null,
          type: item.document!.type,
          metadata: item.document!.metadata ?? {},
          name: item.document!.name,
          notes: item.document!.notes || "",
          created_by: item.document!.created_by ?? null,
          created_at: item.document!.created_at,
          ocr_text: null,
        }));

      setDocuments(normalizedDocuments);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load project documents";
      setError(message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, householdId]);

  useEffect(() => {
    load();
  }, [load]);

  return { documents, loading, error, refresh: load };
}
