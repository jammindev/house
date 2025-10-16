"use client";
import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document, Interaction } from "@interactions/types";

export function useInteraction(id?: string) {
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data: interactionData, error: interactionError } = await client
        .from("interactions")
        .select(
          "id, subject, content, type, status, occurred_at, tags, metadata, enriched_text, created_at, updated_at, household_id, created_by, updated_by"
        )
        .eq("id", id)
        .single();
      if (interactionError) throw interactionError;
      setInteraction((interactionData as unknown as Interaction) ?? null);

      const { data: documentData, error: documentError } = await client
        .from("documents")
        .select("id, interaction_id, file_path, mime_type, type, metadata, name, notes, created_by, created_at")
        .eq("interaction_id", id);
      if (documentError) throw documentError;
      setDocuments((documentData ?? []) as unknown as Document[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load interaction");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { interaction, documents, loading, error, reload: load };
}
