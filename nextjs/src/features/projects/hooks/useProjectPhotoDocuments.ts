"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { PhotoDocument, SupabasePhotoDocumentRow } from "@photos/types";
import { normalizePhotoDocuments } from "@photos/utils/normalizePhotoDocuments";

export function useProjectPhotoDocuments(projectId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const [photos, setPhotos] = useState<PhotoDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!householdId || !projectId) {
      setPhotos([]);
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
                subject,
                project_id
              )
            ),
            zone_documents (
              zone_id,
              zone:zones (
                id,
                name
              )
            )
          `
        )
        .eq("household_id", householdId)
        .eq("type", "photo")
        .eq("interaction_documents.interaction.project_id", projectId)
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;

      const normalized = normalizePhotoDocuments(data as SupabasePhotoDocumentRow[] | null);
      setPhotos(normalized);
    } catch (fetchError: unknown) {
      console.error(fetchError);
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load project photos";
      setError(message);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [householdId, projectId]);

  useEffect(() => {
    void fetchPhotos();
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    error,
    refresh: fetchPhotos,
  };
}
