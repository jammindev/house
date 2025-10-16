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
      const { error: uErr } = await client
        .from("interactions" as any)
        .update({ content })
        .eq("id", interactionId);
      if (uErr) throw uErr;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to update interaction");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateContent, loading, error, setError };
}
