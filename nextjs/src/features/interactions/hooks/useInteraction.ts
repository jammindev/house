"use client";
import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type {
  Document,
  Interaction,
  InteractionContact,
  InteractionStructure,
  InteractionTag,
} from "@interactions/types";

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
    metadata: Document["metadata"];
    name: string;
    notes: string;
    created_by: string | null;
    created_at: string;
  } | null;
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
          contacts:
            row.interaction_contacts
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
            row.interaction_structures
              ?.map((link) => link?.structure)
              .filter((structure): structure is RawStructure => Boolean(structure))
              .map<InteractionStructure>((structure) => ({
                id: structure.id,
                name: structure.name?.trim() ?? "",
                type: structure.type?.trim() || null,
              })) ?? [],
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
              metadata,
              name,
              notes,
              created_by,
              created_at
            )
          `
        )
        .eq("interaction_id", id)
        .order("created_at", { ascending: true });
      if (documentError) throw documentError;
      const normalized =
        (documentData ?? [])
          .map((row) => {
            const docRow = (row as RawInteractionDocument).document;
            if (!docRow) return null;
            return {
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
              interaction_id: (row as RawInteractionDocument).interaction_id,
              link_role: (row as RawInteractionDocument).role,
              link_note: (row as RawInteractionDocument).note,
              link_created_at: (row as RawInteractionDocument).created_at,
            } satisfies Document;
          })
          .filter((doc): doc is Document => Boolean(doc));
      setDocuments(normalized);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to load interaction";
      setError(message);
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
