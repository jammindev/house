"use client";

import { useCallback, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document } from "@interactions/types";

export function useDeleteDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deleteFile = useCallback(async (file: Pick<Document, "id" | "file_path" | "interaction_id">) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // 1) Retrieve current links to decide whether we must delete the document row
      const { data: links, error: linksError } = await client
        .from("interaction_documents")
        .select("interaction_id")
        .eq("document_id", file.id);
      if (linksError) throw linksError;

      // 2) Remove the link for the provided interaction (if any)
      if (file.interaction_id) {
        const { error: unlinkError } = await client
          .from("interaction_documents")
          .delete()
          .eq("document_id", file.id)
          .eq("interaction_id", file.interaction_id);
        if (unlinkError) throw unlinkError;
      } else {
        // Fallback: remove all links if no interaction specified
        const { error: unlinkAllError } = await client
          .from("interaction_documents")
          .delete()
          .eq("document_id", file.id);
        if (unlinkAllError) throw unlinkAllError;
      }

      const remainingLinks = (links ?? []).filter((link) => {
        if (!file.interaction_id) return false;
        return link.interaction_id !== file.interaction_id;
      });

      const shouldDeleteDocument = remainingLinks.length === 0;

      if (shouldDeleteDocument) {
        if (file.file_path) {
          const { error: storageError } = await client.storage.from("files").remove([file.file_path]);
          if (storageError) throw storageError;
        }

        const { error: dbError } = await client.from("documents").delete().eq("id", file.id);
        if (dbError) throw dbError;
      }
    } catch (error: unknown) {
      console.error("Failed to delete document", error);
      const message = error instanceof Error ? error.message : "Failed to delete document";
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteFile, loading, error, setError };
}
