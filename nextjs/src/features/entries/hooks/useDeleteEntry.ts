// nextjs/src/features/entries/hooks/useDeleteEntry.ts
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

      // 1️⃣ Récupère tous les fichiers liés à cette entrée
      const { data: entryFiles, error: filesError } = await client
        .from("entry_files")
        .select("storage_path")
        .eq("entry_id", entryId);

      if (filesError) throw filesError;

      const storagePaths =
        entryFiles?.map((f) => f.storage_path).filter(Boolean) || [];

      // 2️⃣ Supprime les fichiers physiques du bucket (s’il y en a)
      if (storagePaths.length > 0) {
        const { error: storageError } = await client.storage
          .from("files")
          .remove(storagePaths);

        if (storageError) throw storageError;
      }

      // 3️⃣ Supprime l’entrée dans la base
      const { error: deleteError } = await client
        .from("entries")
        .delete()
        .eq("id", entryId);

      if (deleteError) throw deleteError;
    } catch (err: any) {
      console.error("❌ Failed to delete entry:", err);
      setError(err?.message || "Failed to delete entry");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEntry, loading, error, setError };
}
