"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction, Document } from "@interactions/types";

export interface ProjectTimelineData {
    interactions: Interaction[];
    documentsByInteraction: Record<string, Document[]>;
    loading: boolean;
    error: string;
    refetch: () => Promise<void>;
}

export function useProjectTimeline(projectId: string): ProjectTimelineData {
    const { selectedHouseholdId } = useGlobal();
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [documentsByInteraction, setDocumentsByInteraction] = useState<Record<string, Document[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchTimelineData = useCallback(async () => {
        if (!projectId || !selectedHouseholdId) {
            setInteractions([]);
            setDocumentsByInteraction({});
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            // Fetch interactions for timeline (including only completed tasks)
            const { data: interactionsData, error: interactionsError } = await client
                .from("interactions")
                .select(`
          *,
          interaction_tags (
            tag:tags (
              id,
              name
            )
          ),
          interaction_contacts (
            contact:contacts (
              id,
              first_name,
              last_name,
              position,
              structure:structures (
                id,
                name,
                type
              )
            )
          ),
          interaction_structures (
            structure:structures (
              id,
              name,
              type
            )
          )
        `)
                .eq("household_id", selectedHouseholdId)
                .eq("project_id", projectId)
                .or(`type.not.in.(task,todo),and(type.in.(task,todo),status.in.(done,completed))`) // Include non-tasks OR completed tasks only
                .order("occurred_at", { ascending: false });

            if (interactionsError) {
                throw new Error(interactionsError.message);
            }

            // Transform interactions
            const transformedInteractions: Interaction[] = (interactionsData || []).map((raw: any) => ({
                id: raw.id,
                household_id: raw.household_id,
                subject: raw.subject,
                content: raw.content,
                type: raw.type,
                status: raw.status,
                occurred_at: raw.occurred_at,
                project_id: raw.project_id,
                metadata: raw.metadata,
                enriched_text: raw.enriched_text,
                created_at: raw.created_at,
                updated_at: raw.updated_at,
                created_by: raw.created_by,
                updated_by: raw.updated_by,
                tags: raw.interaction_tags?.map((it: any) => it.tag).filter((tag: any) => Boolean(tag)) || [],
                contacts: raw.interaction_contacts?.map((ic: any) => ({
                    id: ic.contact?.id || "",
                    first_name: ic.contact?.first_name || "",
                    last_name: ic.contact?.last_name || "",
                    position: ic.contact?.position || null,
                    structure: ic.contact?.structure || null,
                })).filter((contact: any) => Boolean(contact.id)) || [],
                structures: raw.interaction_structures?.map((is: any) => ({
                    id: is.structure?.id || "",
                    name: is.structure?.name || "",
                    type: is.structure?.type || null,
                })).filter((structure: any) => Boolean(structure.id)) || [],
            }));

            setInteractions(transformedInteractions);

            // Fetch documents for each interaction via join table
            if (transformedInteractions.length > 0) {
                const interactionIds = transformedInteractions.map(i => i.id);

                const { data: interactionDocsData, error: interactionDocsError } = await client
                    .from("interaction_documents")
                    .select(`
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
          `)
                    .in("interaction_id", interactionIds);

                if (interactionDocsError) {
                    throw new Error(interactionDocsError.message);
                }

                // Group documents by interaction
                const docsByInteraction: Record<string, Document[]> = {};
                (interactionDocsData || []).forEach((row: any) => {
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

                    if (!docsByInteraction[interactionId]) {
                        docsByInteraction[interactionId] = [];
                    }
                    docsByInteraction[interactionId].push(doc);
                });

                setDocumentsByInteraction(docsByInteraction);
            } else {
                setDocumentsByInteraction({});
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch project timeline";
            setError(message);
            console.error("useProjectTimeline error:", err);
        } finally {
            setLoading(false);
        }
    }, [projectId, selectedHouseholdId]);

    useEffect(() => {
        fetchTimelineData();
    }, [fetchTimelineData]);

    return {
        interactions,
        documentsByInteraction,
        loading,
        error,
        refetch: fetchTimelineData,
    };
}