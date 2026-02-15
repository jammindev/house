// nextjs/src/features/interactions/hooks/useInteractionActions.ts
"use client";
import { useCallback, useState } from "react";

import { InteractionService, type UpdateInteractionInput } from "@interactions/services";

/**
 * Unified hook for all interaction operations
 * Combines get, update, and delete operations in a single hook
 */
export function useInteractionActions() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const getInteraction = useCallback(async (id: string) => {
        setLoading(true);
        setError("");
        try {
            const result = await InteractionService.getInteractionById(id);
            return result;
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Failed to load interaction";
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateInteraction = useCallback(async (interactionId: string, input: UpdateInteractionInput) => {
        setLoading(true);
        setError("");
        try {
            await InteractionService.updateInteractionById(interactionId, input);
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Failed to update interaction";
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteInteraction = useCallback(async (interactionId: string) => {
        setLoading(true);
        setError("");
        try {
            await InteractionService.deleteInteractionById(interactionId);
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Failed to delete interaction";
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError("");
    }, []);

    return {
        getInteraction,
        updateInteraction,
        deleteInteraction,
        loading,
        error,
        clearError
    };
}