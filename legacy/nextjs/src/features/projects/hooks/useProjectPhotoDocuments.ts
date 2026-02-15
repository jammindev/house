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

      // Requête corrigée : partir de interaction_documents pour avoir la jointure correcte
      const { data, error: supabaseError } = await client
        .from("interaction_documents")
        .select(
          `
            document_id,
            interaction_id,
            interactions!inner (
              id,
              subject,
              project_id,
              household_id
            ),
            documents!inner (
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
              zone_documents (
                zone_id,
                zone:zones (
                  id,
                  name
                )
              )
            )
          `
        )
        .eq("interactions.project_id", projectId)
        .eq("interactions.household_id", householdId)
        .eq("documents.type", "photo")
        .eq("documents.household_id", householdId)
        .order("created_at", { ascending: false, referencedTable: "documents" });

      if (supabaseError) throw supabaseError;

      // Transformer les données pour correspondre au format attendu
      const transformedData = data?.map(item => ({
        ...item.documents,
        interaction_documents: [{
          interaction_id: item.interaction_id,
          interaction: item.interactions
        }]
      })) ?? [];

      const normalized = normalizePhotoDocuments(transformedData as SupabasePhotoDocumentRow[] | null);
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
