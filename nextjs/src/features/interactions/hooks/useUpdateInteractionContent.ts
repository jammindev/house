// nextjs/src/features/interactions/hooks/useUpdateInteractionContent.ts
"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useUpdateInteractionContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateContent = useCallback(async (interactionId: string, content: string) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: uErr } = await client.from("interactions").update({ content }).eq("id", interactionId);
      if (uErr) throw uErr;
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to update interaction";
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateContent, loading, error, setError };
}
