// nextjs/src/features/interactions/hooks/useUpdateInteractionStatus.ts
"use client";

import { useCallback, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { InteractionStatus } from "@interactions/types";

export function useUpdateInteractionStatus() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const updateStatus = useCallback(async (interactionId: string, status: InteractionStatus) => {
        setLoading(true);
        setError("");
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { error: updateError } = await client
                .from("interactions")
                .update({ status })
                .eq("id", interactionId);

            if (updateError) {
                throw updateError;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update task status";
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateStatus, loading, error, setError };
}