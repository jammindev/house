import { useCallback, useEffect, useState } from "react";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import type { Interaction, InteractionTag, InteractionContact, InteractionStructure, InteractionProjectSummary } from "@interactions/types";

interface InteractionWithCounts extends Interaction {
    documentCount: number;
}

type RawInteraction = {
    id: string;
    household_id: string;
    subject: string;
    content: string;
    type: Interaction["type"];
    status: Interaction["status"];
    occurred_at: string;
    project_id?: string | null;
    project?: RawProject | null;
    metadata: Interaction["metadata"];
    enriched_text: Interaction["enriched_text"];
    is_private: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
    interaction_tags?: { tag?: InteractionTag | null }[] | null;
    interaction_contacts?: { contact?: RawContact | null }[] | null;
    interaction_structures?: { structure?: RawStructure | null }[] | null;
};

type RawProject = {
    id: string;
    title?: string | null;
    status?: InteractionProjectSummary["status"] | null;
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

const normalizeText = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
};

export function useUpcomingInteractions(householdId: string | null) {
    const [interactions, setInteractions] = useState<InteractionWithCounts[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!householdId) {
            setInteractions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient();

            // Récupérer les interactions futures (occurred_at > now)
            const { data: interactionsData, error: interactionsError } = await client
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
          project:projects!interactions_project_id_fkey(
            id,
            title,
            status
          ),
          created_at,
          updated_at,
          household_id,
          metadata,
          enriched_text,
          is_private,
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
                .gt("occurred_at", new Date().toISOString())
                .order("occurred_at", { ascending: true })
                .limit(10);

            if (interactionsError) throw interactionsError;

            if (!interactionsData || interactionsData.length === 0) {
                setInteractions([]);
                setLoading(false);
                return;
            }

            const list = (interactionsData ?? []) as RawInteraction[];

            // Récupérer le nombre de documents pour chaque interaction
            const interactionIds = list.map((i) => i.id);
            const { data: documentCounts, error: documentsError } = await client
                .from("interaction_documents")
                .select("interaction_id")
                .in("interaction_id", interactionIds);

            if (documentsError) throw documentsError;

            // Compter les documents par interaction
            const countsByInteractionId = new Map<string, number>();
            if (documentCounts) {
                for (const doc of documentCounts) {
                    const currentCount = countsByInteractionId.get(doc.interaction_id) || 0;
                    countsByInteractionId.set(doc.interaction_id, currentCount + 1);
                }
            }

            // Normaliser les données
            const enriched: InteractionWithCounts[] = list.map((item) => {
                const project: InteractionProjectSummary | null = item.project
                    ? {
                        id: item.project.id,
                        title: item.project.title?.trim() ?? "",
                        status: (item.project.status ?? "draft") as InteractionProjectSummary["status"],
                    }
                    : null;

                const tags =
                    item.interaction_tags
                        ?.map((entry) => entry?.tag)
                        .filter((tag): tag is InteractionTag => Boolean(tag)) ?? [];

                const contacts =
                    item.interaction_contacts
                        ?.map((link) => link?.contact)
                        .filter((contact): contact is RawContact => Boolean(contact))
                        .map<InteractionContact>((contact) => ({
                            id: contact.id,
                            first_name: normalizeText(contact.first_name) ?? "",
                            last_name: normalizeText(contact.last_name) ?? "",
                            position: normalizeText(contact.position),
                            structure: contact.structure
                                ? {
                                    id: contact.structure.id,
                                    name: normalizeText(contact.structure.name) ?? "",
                                    type: normalizeText(contact.structure.type),
                                }
                                : null,
                            emails: [],
                            phones: [],
                        })) ?? [];

                const structures =
                    item.interaction_structures
                        ?.map((link) => link?.structure)
                        .filter((structure): structure is RawStructure => Boolean(structure))
                        .map<InteractionStructure>((structure) => ({
                            id: structure.id,
                            name: normalizeText(structure.name) ?? "",
                            type: normalizeText(structure.type),
                            emails: [],
                            phones: [],
                        })) ?? [];

                return {
                    id: item.id,
                    household_id: item.household_id,
                    subject: item.subject,
                    content: item.content,
                    type: item.type,
                    status: item.status,
                    occurred_at: item.occurred_at,
                    project_id: item.project_id ?? project?.id ?? null,
                    project,
                    tags,
                    contacts,
                    structures,
                    metadata: item.metadata,
                    enriched_text: item.enriched_text,
                    is_private: item.is_private ?? false,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    created_by: item.created_by ?? null,
                    updated_by: item.updated_by ?? null,
                    documentCount: countsByInteractionId.get(item.id) || 0,
                };
            });

            setInteractions(enriched);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unexpected error";
            setError(message);
            setInteractions([]);
        } finally {
            setLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        void load();
    }, [load]);

    return { interactions, loading, error, reload: load };
}
