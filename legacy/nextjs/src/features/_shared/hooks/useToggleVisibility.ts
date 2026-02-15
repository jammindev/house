// nextjs/src/features/_shared/hooks/useToggleVisibility.ts
"use client";

import { useState } from "react";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";

export type EntityType = "project" | "project_group" | "interaction";

interface UseToggleVisibilityOptions {
    entityType: EntityType;
    entityId: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export function useToggleVisibility({
    entityType,
    entityId,
    onSuccess,
    onError,
}: UseToggleVisibilityOptions) {
    const [loading, setLoading] = useState(false);

    const toggle = async (currentIsPrivate: boolean) => {
        setLoading(true);
        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient();
            const newValue = !currentIsPrivate;

            const tableName = entityType === "project_group" ? "project_groups" : `${entityType}s`;

            const { error } = await client
                .from(tableName as any)
                .update({ is_private: newValue })
                .eq("id", entityId);

            if (error) throw error;

            onSuccess?.();
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to toggle visibility");
            onError?.(error);
        } finally {
            setLoading(false);
        }
    };

    return { toggle, loading };
}