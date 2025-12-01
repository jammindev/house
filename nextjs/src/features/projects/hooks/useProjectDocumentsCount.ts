"use client";

import { useCallback, useEffect, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";

export function useProjectDocumentsCount(projectId?: string) {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [documentsCount, setDocumentsCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDocumentsCount = useCallback(async () => {
        if (!householdId || !projectId) {
            setDocumentsCount(0);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            // Compter les documents non-photos liés aux interactions du projet
            const { data: documentsData, error: documentsError } = await client
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
                .neq("documents.type", "photo") // Exclure les photos
                .eq("documents.household_id", householdId);

            if (documentsError) throw documentsError;

            const count = documentsData?.length ?? 0;
            console.log(`Project ${projectId}: found ${count} non-photo documents`);
            setDocumentsCount(count);
        } catch (fetchError: unknown) {
            console.error("Error fetching documents count:", fetchError);
            const message = fetchError instanceof Error ? fetchError.message : "Failed to load documents count";
            setError(message);
            setDocumentsCount(0);
        } finally {
            setLoading(false);
        }
    }, [householdId, projectId]);

    useEffect(() => {
        void fetchDocumentsCount();
    }, [fetchDocumentsCount]);

    return {
        documentsCount,
        loading,
        error,
        refresh: fetchDocumentsCount,
    };
}