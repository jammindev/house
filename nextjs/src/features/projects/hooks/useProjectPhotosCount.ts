"use client";

import { useCallback, useEffect, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";

export function useProjectPhotosCount(projectId?: string) {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [photosCount, setPhotosCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPhotosCount = useCallback(async () => {
        if (!householdId || !projectId) {
            setPhotosCount(0);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            // Requête directe avec jointure pour récupérer les photos liées aux interactions du projet
            const { data: photoDocuments, error: photosError } = await client
                .from("interaction_documents")
                .select(`
          document_id,
          interaction_id,
          interactions!inner (
            id,
            project_id,
            household_id
          ),
          documents!inner (
            id,
            type,
            household_id
          )
        `)
                .eq("interactions.project_id", projectId)
                .eq("interactions.household_id", householdId)
                .eq("documents.type", "photo")
                .eq("documents.household_id", householdId);

            if (photosError) throw photosError;

            const photosCount = photoDocuments?.length ?? 0;
            console.log(`Project ${projectId}: found ${photosCount} photos`);
            setPhotosCount(photosCount);
        } catch (fetchError: unknown) {
            console.error("Error fetching photos count:", fetchError);
            const message = fetchError instanceof Error ? fetchError.message : "Failed to load photos count";
            setError(message);
            setPhotosCount(0);
        } finally {
            setLoading(false);
        }
    }, [householdId, projectId]);

    useEffect(() => {
        void fetchPhotosCount();
    }, [fetchPhotosCount]);

    return {
        photosCount,
        loading,
        error,
        refresh: fetchPhotosCount,
    };
}