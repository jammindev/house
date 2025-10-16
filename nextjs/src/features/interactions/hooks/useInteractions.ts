"use client";
import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document, Interaction } from "@interactions/types";

type DocumentsByInteraction = Record<string, Document[]>;

export function useInteractions(householdId?: string | null) {
  const { t } = useI18n();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [documentsByInteraction, setDocumentsByInteraction] = useState<DocumentsByInteraction>({});
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      setInteractions([]);
      setDocumentsByInteraction({});
      try {
        if (!householdId) return;
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data: interactionData, error: interactionError } = await client
          .from("interactions")
          .select(
            "id, subject, content, type, status, occurred_at, tags, created_at, updated_at, household_id, metadata, enriched_text, created_by, updated_by"
          )
          .eq("household_id", householdId)
          .order("occurred_at" as any, { ascending: false })
          .limit(100);
        if (interactionError) throw interactionError;
        const list = (interactionData ?? []) as unknown as Interaction[];
        setInteractions(list);

        const ids = list.map((interaction) => interaction.id);
        if (ids.length > 0) {
          const { data: documentData, error: documentError } = await client
            .from("documents")
            .select("id, interaction_id, file_path, mime_type, type, name, notes, metadata, created_at, created_by")
            .in("interaction_id", ids);
          if (documentError) throw documentError;
          const grouped: DocumentsByInteraction = {};
          ((documentData ?? []) as unknown as Document[]).forEach((doc) => {
            const arr = grouped[doc.interaction_id] || [];
            arr.push(doc);
            grouped[doc.interaction_id] = arr;
          });
          setDocumentsByInteraction(grouped);
          const counts: Record<string, number> = {};
          Object.keys(grouped).forEach((key) => {
            counts[key] = grouped[key].length;
          });
          setDocumentCounts(counts);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t("entries.listLoadFailed"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [householdId, t]);

  return { interactions, documentsByInteraction, documentCounts, loading, error, setError };
}
