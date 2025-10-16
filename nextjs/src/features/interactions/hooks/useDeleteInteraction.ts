// nextjs/src/features/interactions/hooks/useDeleteInteraction.ts
"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteInteraction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deleteInteraction = useCallback(async (interactionId: string) => {
    setLoading(true);
    setError("");

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // 1️⃣ Récupère tous les documents liés à cette interaction
      const { data: documents, error: filesError } = await client
        .from("documents")
        .select("file_path")
        .eq("interaction_id", interactionId);

      if (filesError) throw filesError;

      const storagePaths =
        documents?.map((doc) => doc.file_path).filter(Boolean) || [];

      // 2️⃣ Supprime les fichiers physiques du bucket (s’il y en a)
      if (storagePaths.length > 0) {
        const { error: storageError } = await client.storage
          .from("files")
          .remove(storagePaths);

        if (storageError) throw storageError;
      }

      // 3️⃣ Supprime l’interaction dans la base
      const { error: deleteError } = await client
        .from("interactions")
        .delete()
        .eq("id", interactionId);

      if (deleteError) throw deleteError;
    } catch (err: any) {
      console.error("❌ Failed to delete interaction:", err);
      setError(err?.message || "Failed to delete interaction");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteInteraction, loading, error, setError };
}
