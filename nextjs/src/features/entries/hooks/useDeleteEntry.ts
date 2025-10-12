"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteEntry() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deleteEntry = useCallback(async (entryId: string) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: deleteError } = await client.from("entries" as any).delete().eq("id", entryId);
      if (deleteError) throw deleteError;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to delete entry");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEntry, loading, error, setError };
}
