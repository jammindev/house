"use client";

import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  Interaction,
  InteractionContact,
  InteractionProjectSummary,
  InteractionStructure,
  InteractionTag,
} from "@interactions/types";

type RawStructure = {
  id: string;
  name?: string | null;
  type?: string | null;
};

type RawContact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  structure?: RawStructure | null;
};

type RawProject = {
  id: string;
  title?: string | null;
  status?: InteractionProjectSummary["status"] | null;
};

type RawInteraction = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  type: Interaction["type"];
  status: Interaction["status"];
  occurred_at: string;
  project_id?: string | null;
  metadata: Interaction["metadata"];
  enriched_text: Interaction["enriched_text"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  interaction_tags?: { tag?: InteractionTag | null }[] | null;
  interaction_contacts?: { contact?: RawContact | null }[] | null;
  interaction_structures?: { structure?: RawStructure | null }[] | null;
  project?: RawProject | null;
};

type RawDocumentCountRow = {
  interaction_id?: string | null;
};

const DEFAULT_LIMIT = 5;

function mapInteraction(raw: RawInteraction): Interaction {
  const project: InteractionProjectSummary | null = raw.project
    ? {
        id: raw.project.id,
        title: raw.project.title?.trim() ?? "",
        status: (raw.project.status ?? "draft") as InteractionProjectSummary["status"],
      }
    : null;

  const tags =
    raw.interaction_tags?.map((entry) => entry?.tag).filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];

  const contacts =
    raw.interaction_contacts
      ?.map((link) => link?.contact)
      .filter((contact): contact is RawContact => Boolean(contact))
      .map<InteractionContact>((contact) => ({
        id: contact.id,
        first_name: contact.first_name?.trim() ?? "",
        last_name: contact.last_name?.trim() ?? "",
        position: contact.position?.trim() || null,
        structure: contact.structure
          ? {
              id: contact.structure.id,
              name: contact.structure.name?.trim() ?? "",
              type: contact.structure.type?.trim() || null,
            }
          : null,
      })) ?? [];

  const structures =
    raw.interaction_structures
      ?.map((link) => link?.structure)
      .filter((structure): structure is RawStructure => Boolean(structure))
      .map<InteractionStructure>((structure) => ({
        id: structure.id,
        name: structure.name?.trim() ?? "",
        type: structure.type?.trim() || null,
      })) ?? [];

  return {
    id: raw.id,
    household_id: raw.household_id,
    subject: raw.subject,
    content: raw.content,
    type: raw.type,
    status: raw.status,
    occurred_at: raw.occurred_at,
    project_id: raw.project_id ?? project?.id ?? null,
    project,
    tags,
    contacts,
    structures,
    metadata: raw.metadata,
    enriched_text: raw.enriched_text,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    created_by: raw.created_by ?? null,
    updated_by: raw.updated_by ?? null,
  };
}

export function useContactInteractions(contactId?: string | null, options?: { limit?: number }) {
  const { t } = useI18n();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const limit = options?.limit ?? DEFAULT_LIMIT;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!contactId) {
        setInteractions([]);
        setDocumentCounts({});
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data: rows, error: interactionsError } = await client
          .from("interactions")
          .select(
            `
              id,
              subject,
              content,
              type,
              status,
              occurred_at,
              project_id,
              metadata,
              enriched_text,
              created_at,
              updated_at,
              household_id,
              created_by,
              updated_by,
              interaction_tags:interaction_tags(
                tag:tags(
                  id,
                  household_id,
                  type,
                  name,
                  created_at,
                  created_by
                )
              ),
              interaction_contacts:interaction_contacts!inner(
                contact:contacts(
                  id,
                  first_name,
                  last_name,
                  position,
                  structure:structures(
                    id,
                    name,
                    type
                  )
                )
              ),
              interaction_structures:interaction_structures(
                structure:structures(
                  id,
                  name,
                  type
                )
              ),
              project:projects!interactions_project_id_fkey(
                id,
                title,
                status
              )
            `
          )
          .eq("interaction_contacts.contact_id", contactId)
          .order("occurred_at", { ascending: false })
          .limit(limit);

        if (interactionsError) throw interactionsError;

        const mapped = ((rows ?? []) as RawInteraction[]).map(mapInteraction);

        mapped.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
        const limitedInteractions = mapped.slice(0, limit);

        if (!cancelled) {
          setInteractions(limitedInteractions);
        }

        const interactionIds = limitedInteractions.map((item) => item.id);
        if (interactionIds.length > 0) {
          const { data: docRows, error: docError } = await client
            .from("interaction_documents")
            .select("interaction_id")
            .in("interaction_id", interactionIds);

          if (docError) throw docError;

          const counts: Record<string, number> = {};
          for (const row of (docRows ?? []) as RawDocumentCountRow[]) {
            const interactionId = row.interaction_id;
            if (!interactionId) continue;
            counts[interactionId] = (counts[interactionId] ?? 0) + 1;
          }

          if (!cancelled) {
            setDocumentCounts(counts);
          }
        } else if (!cancelled) {
          setDocumentCounts({});
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;

        setInteractions([]);
        setDocumentCounts({});
        setLoading(false);
        setError(err instanceof Error ? err.message : t("contacts.latestInteractionsError"));
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [contactId, limit, t]);

  return { interactions, documentCounts, loading, error };
}
