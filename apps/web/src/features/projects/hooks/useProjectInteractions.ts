"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  project_id: string | null;
  metadata: Interaction["metadata"];
  enriched_text: Interaction["enriched_text"];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  interaction_tags?: { tag?: InteractionTag | null }[] | null;
  interaction_contacts?: { contact?: RawContact | null }[] | null;
  interaction_structures?: { structure?: RawStructure | null }[] | null;
  interaction_documents?: RawInteractionDocument[] | null;
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

export type ProjectInteractionSummary = {
  interactions: Interaction[];
  documentsByInteraction: Record<string, Document[]>;
  tasks: Interaction[];
  expenses: Interaction[];
  documents: Document[];
};

export function useProjectInteractions(projectId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [data, setData] = useState<ProjectInteractionSummary>({
    interactions: [],
    documentsByInteraction: {},
    tasks: [],
    expenses: [],
    documents: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!projectId || !householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: interactionRows, error: interactionError } = await client
        .from("interactions")
        .select(
          `
            id,
            household_id,
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
            ),
            interaction_documents:interaction_documents(
              interaction_id,
              role,
              note,
              created_at,
              document:documents(
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
            )
          `
        )
        .eq("project_id", projectId)
        .eq("household_id", householdId)
        .order("occurred_at", { ascending: false });

      if (interactionError) throw interactionError;

      const interactions = (interactionRows ?? []) as RawInteraction[];

      const normalizedInteractions: Interaction[] = interactions.map((item) => {
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

      const documentsByInteraction: Record<string, Document[]> = {};
      normalizedInteractions.forEach((interaction) => {
        documentsByInteraction[interaction.id] = [];
      });

      interactions.forEach((raw) => {
        const docs =
          raw.interaction_documents
            ?.map((link) => link.document)
            .filter((doc): doc is RawInteractionDocument["document"] => Boolean(doc))
            .map<Document>((doc) => ({
              id: doc.id,
              household_id: doc.household_id,
              file_path: doc.file_path,
              mime_type: doc.mime_type,
              type: doc.type,
              metadata: doc.metadata,
              name: doc.name,
              notes: doc.notes,
              created_at: doc.created_at,
              created_by: doc.created_by ?? null,
            })) ?? [];
        if (!documentsByInteraction[raw.id]) {
          documentsByInteraction[raw.id] = docs;
        } else {
          documentsByInteraction[raw.id] = [...documentsByInteraction[raw.id], ...docs];
        }
      });

      const tasks = normalizedInteractions.filter((interaction) => interaction.type === "todo");
      const expenses = normalizedInteractions.filter((interaction) => interaction.type === "expense");
      const documents = Object.values(documentsByInteraction).flat();

      setData({
        interactions: normalizedInteractions,
        documentsByInteraction,
        tasks,
        expenses,
        documents,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setData({
        interactions: [],
        documentsByInteraction: {},
        tasks: [],
        expenses: [],
        documents: [],
      });
    } finally {
      setLoading(false);
    }
  }, [householdId, projectId, t]);

  useEffect(() => {
    if (!projectId || !householdId) {
      setData({
        interactions: [],
        documentsByInteraction: {},
        tasks: [],
        expenses: [],
        documents: [],
      });
      return;
    }
    void load();
  }, [householdId, projectId, load]);

  const memoized = useMemo(() => data, [data]);

  return {
    ...memoized,
    loading,
    error,
    reload: load,
  };
}
