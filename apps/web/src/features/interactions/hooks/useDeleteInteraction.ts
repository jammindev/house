// nextjs/src/features/interactions/hooks/useDeleteInteraction.ts
"use client";

import { useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteInteraction() {
  return useCallback(async (interactionId: string) => {
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      // Deleting the interaction is enough—RLS + FK constraints take care of detaching documents
      // and we intentionally keep the underlying storage objects for future reuse.
      const { error: deleteError } = await client
        .from("interactions")
        .delete()
        .eq("id", interactionId);

      if (deleteError) throw deleteError;
    } catch (error: unknown) {
      console.error("❌ Failed to delete interaction:", error);
      throw error;
    }
  }, []);
}
