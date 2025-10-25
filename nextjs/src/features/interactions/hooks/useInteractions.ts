// nextjs/src/features/interactions/hooks/useInteractions.ts
"use client";
import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  Document,
  Interaction,
  InteractionContact,
  InteractionStructure,
  InteractionTag,
} from "@interactions/types";
import { useGlobal } from "@/lib/context/GlobalContext";

type DocumentsByInteraction = Record<string, Document[]>;
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
};

type RawContact = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  structure?: RawStructure | null;
};

type RawStructure = {
  id: string;
  name?: string | null;
  type?: string | null;
};

type RawInteractionDocument = {
  interaction_id: string;
  role: string | null;
  note: string | null;
  created_at: string;
  document: {
    id: string;
    household_id: string;
    file_path: string;
    mime_type: string | null;
    type: Document["type"];
    name: string;
    notes: string;
    metadata: Document["metadata"];
    created_at: string;
    created_by: string | null;
  } | null;
};

export function useInteractions() {
  const { selectedHouseholdId: householdId } = useGlobal();
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
            `
              id,
              subject,
              content,
              type,
              status,
              occurred_at,
              project_id,
              created_at,
              updated_at,
              household_id,
              metadata,
              enriched_text,
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
              interaction_contacts:interaction_contacts(
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
              )
            `
          )
          .eq("household_id", householdId)
          .order("occurred_at", { ascending: false })
          .limit(100);
        if (interactionError) throw interactionError;
        const list = (interactionData ?? []) as RawInteraction[];
        const normalized: Interaction[] = list.map((item) => {
          const tags =
            item.interaction_tags
              ?.map((entry) => entry?.tag)
              .filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];

          return {
            id: item.id,
            household_id: item.household_id,
            subject: item.subject,
            content: item.content,
            type: item.type,
            status: item.status,
            occurred_at: item.occurred_at,
            project_id: item.project_id ?? null,
            project: null,
            tags,
            contacts:
              item.interaction_contacts
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
                })) ?? [],
            structures:
              item.interaction_structures
                ?.map((link) => link?.structure)
                .filter((structure): structure is RawStructure => Boolean(structure))
                .map<InteractionStructure>((structure) => ({
                  id: structure.id,
                  name: structure.name?.trim() ?? "",
                  type: structure.type?.trim() || null,
                })) ?? [],
            metadata: item.metadata,
            enriched_text: item.enriched_text,
            created_at: item.created_at,
            updated_at: item.updated_at,
            created_by: item.created_by ?? null,
            updated_by: item.updated_by ?? null,
          };
        });
        setInteractions(normalized);

        const ids = normalized.map((interaction) => interaction.id);
        if (ids.length > 0) {
          const { data: documentData, error: documentError } = await client
            .from("interaction_documents")
            .select(
              `
                interaction_id,
                role,
                note,
                created_at,
                document:documents (
                  id,
                  household_id,
                  file_path,
                  mime_type,
                  type,
                  name,
                  notes,
                  metadata,
                  created_at,
                  created_by
                )
              `
            )
            .in("interaction_id", ids);
          if (documentError) throw documentError;
          const grouped: DocumentsByInteraction = {};
          (documentData ?? []).forEach((raw) => {
            const row = raw as RawInteractionDocument;
            const docRow = row.document;
            if (!docRow) return;
            const interactionId = row.interaction_id;
            if (!interactionId) return;
            const doc: Document = {
              id: docRow.id,
              household_id: docRow.household_id,
              file_path: docRow.file_path,
              name: docRow.name ?? "",
              notes: docRow.notes ?? "",
              mime_type: docRow.mime_type ?? null,
              type: (docRow.type ?? "document") as Document["type"],
              metadata: docRow.metadata,
              created_at: docRow.created_at,
              created_by: docRow.created_by ?? null,
              interaction_id: interactionId,
              link_role: row.role ?? null,
              link_note: row.note ?? null,
              link_created_at: row.created_at ?? null,
            };
            const arr = grouped[interactionId] || [];
            arr.push(doc);
            grouped[interactionId] = arr;
          });
          setDocumentsByInteraction(grouped);
          const counts: Record<string, number> = {};
          Object.keys(grouped).forEach((key) => {
            counts[key] = grouped[key].length;
          });
          setDocumentCounts(counts);
        }
      } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("interactionslistLoadFailed");
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [householdId, t]);

  return { interactions, documentsByInteraction, documentCounts, loading, error, setError };
}
