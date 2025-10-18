"use client";
import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document, Interaction, InteractionTag } from "@interactions/types";

type RawInteraction = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  type: Interaction["type"];
  status: Interaction["status"];
  occurred_at: string;
  metadata: Interaction["metadata"];
  enriched_text: Interaction["enriched_text"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  contact_id?: string | null;
  structure_id?: string | null;
  interaction_tags?: { tag?: InteractionTag | null }[] | null;
};

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
          `
            id,
            subject,
            content,
            type,
            status,
            occurred_at,
            metadata,
            enriched_text,
            created_at,
            updated_at,
            household_id,
            created_by,
            updated_by,
            contact_id,
            structure_id,
            interaction_tags:interaction_tags(
              tag:tags(
                id,
                household_id,
                type,
                name,
                created_at,
                created_by
              )
            )
          `
        )
        .eq("id", id)
        .single();
      if (interactionError) throw interactionError;
      const row = (interactionData as RawInteraction | null) ?? null;
      if (row) {
        const tags =
          row.interaction_tags
            ?.map((entry) => entry?.tag)
            .filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];
        setInteraction({
          id: row.id,
          household_id: row.household_id,
          subject: row.subject,
          content: row.content,
          type: row.type,
          status: row.status,
          occurred_at: row.occurred_at,
          tags,
          contact_id: row.contact_id ?? null,
          structure_id: row.structure_id ?? null,
          metadata: row.metadata,
          enriched_text: row.enriched_text,
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by ?? null,
          updated_by: row.updated_by ?? null,
        });
      } else {
        setInteraction(null);
      }

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
