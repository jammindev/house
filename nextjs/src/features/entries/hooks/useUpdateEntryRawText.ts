// nextjs/src/features/entries/hooks/useUpdateEntryRawText.ts
"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useUpdateEntryRawText() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateRawText = useCallback(async (entryId: string, rawText: string) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: uErr } = await client
        .from("entries" as any)
        .update({ raw_text: rawText })
        .eq("id", entryId);
      if (uErr) throw uErr;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to update entry");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateRawText, loading, error, setError };
}

