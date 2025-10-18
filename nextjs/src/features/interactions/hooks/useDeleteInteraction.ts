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

      // 1️⃣ Récupère tous les documents liés à cette interaction et leurs usages
      const { data: linkedRows, error: linkError } = await client
        .from("interaction_documents")
        .select("document_id, document:documents(file_path)")
        .eq("interaction_id", interactionId);
      if (linkError) throw linkError;

      const documentIds =
        linkedRows?.map((row) => row.document_id).filter((id): id is string => Boolean(id)) ?? [];

      // 2️⃣ Détermine quels documents ne sont liés à aucune autre interaction
      let orphanDocumentIds: string[] = [];
      if (documentIds.length > 0) {
        const { data: usageRows, error: usageError } = await client
          .from("interaction_documents")
          .select("document_id, interaction_id")
          .in("document_id", documentIds);
        if (usageError) throw usageError;

        const usageCount = new Map<string, number>();
        usageRows?.forEach((row) => {
          const current = usageCount.get(row.document_id) ?? 0;
          usageCount.set(row.document_id, current + 1);
        });
        orphanDocumentIds = documentIds.filter((id) => (usageCount.get(id) ?? 0) <= 1);
      }

      const orphanStoragePaths =
        linkedRows
          ?.filter((row) => orphanDocumentIds.includes(row.document_id))
          .map((row) => row.document?.file_path)
          .filter((path): path is string => Boolean(path)) ?? [];

      // 3️⃣ Supprime l’interaction dans la base (cascade sur interaction_documents)
      const { error: deleteError } = await client
        .from("interactions")
        .delete()
        .eq("id", interactionId);

      if (deleteError) throw deleteError;

      // 4️⃣ Supprime les documents devenus orphelins + leurs fichiers
      if (orphanDocumentIds.length > 0) {
        if (orphanStoragePaths.length > 0) {
          const { error: storageError } = await client.storage.from("files").remove(orphanStoragePaths);
          if (storageError) throw storageError;
        }

        const { error: docDeleteError } = await client
          .from("documents")
          .delete()
          .in("id", orphanDocumentIds);
        if (docDeleteError) throw docDeleteError;
      }
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
