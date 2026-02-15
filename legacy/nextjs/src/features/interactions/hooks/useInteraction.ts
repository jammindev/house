// nextjs/src/features/interactions/hooks/useInteraction.ts
"use client";
import { useCallback, useEffect, useState } from "react";

import { useInteractionActions } from "./useInteractionActions";
import type { Document, Interaction } from "@interactions/types";
import type { UpdateInteractionInput } from "@interactions/services";

export function useInteraction(id?: string) {
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const {
    getInteraction,
    updateInteraction: updateInteractionAction,
    deleteInteraction: deleteInteractionAction,
    loading,
    error,
    clearError
  } = useInteractionActions();

  const load = useCallback(async () => {
    if (!id) return;

    try {
      const { interaction, documents } = await getInteraction(id);
      setInteraction(interaction);
      setDocuments(documents);
    } catch (error) {
      // Error is already handled by useInteractionActions
      setInteraction(null);
      setDocuments([]);
    }
  }, [id, getInteraction]);

  const updateInteraction = useCallback(async (interactionId: string, input: UpdateInteractionInput) => {
    await updateInteractionAction(interactionId, input);
    // Reload the interaction after update
    if (interactionId === id) {
      await load();
    }
  }, [updateInteractionAction, id, load]);

  const deleteInteraction = useCallback(async (interactionId: string) => {
    await deleteInteractionAction(interactionId);
    // Clear the interaction if we deleted the current one
    if (interactionId === id) {
      setInteraction(null);
      setDocuments([]);
    }
  }, [deleteInteractionAction, id]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    interaction,
    documents,
    loading,
    error,
    reload: load,
    updateInteraction,
    deleteInteraction,
    setError: clearError
  };
}
