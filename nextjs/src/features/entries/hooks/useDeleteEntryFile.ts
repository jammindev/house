"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { EntryFile } from "@entries/types";

export function useDeleteEntryFile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deleteFile = useCallback(async (file: Pick<EntryFile, "id" | "storage_path">) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // 1) Delete physical object from storage bucket
      if (file.storage_path) {
        const { error: storageError } = await client.storage
          .from("files")
          .remove([file.storage_path]);
        if (storageError) throw storageError;
      }

      // 2) Delete DB row
      const { error: dbError } = await client
        .from("entry_files" as any)
        .delete()
        .eq("id", file.id);
      if (dbError) throw dbError;
    } catch (e: any) {
      console.error("Failed to delete entry file", e);
      setError(e?.message || "Failed to delete file");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteFile, loading, error, setError };
}

