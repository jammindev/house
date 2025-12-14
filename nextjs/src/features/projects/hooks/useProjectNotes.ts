"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction, Document } from "@interactions/types";

export interface ProjectNotesData {
  notes: Interaction[];
  documentsByNote: Record<string, Document[]>;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

export function useProjectNotes(projectId: string): ProjectNotesData {
  const { selectedHouseholdId } = useGlobal();
  const [notes, setNotes] = useState<Interaction[]>([]);
  const [documentsByNote, setDocumentsByNote] = useState<Record<string, Document[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotesData = useCallback(async () => {
    if (!projectId || !selectedHouseholdId) {
      setNotes([]);
      setDocumentsByNote({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // Fetch only note interactions for the project
      const { data: notesData, error: notesError } = await client
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
        .eq("type", "note") // Only fetch notes
        .order("occurred_at", { ascending: false });

      if (notesError) {
        throw new Error(notesError.message);
      }

      // Transform notes
      const transformedNotes: Interaction[] = (notesData || []).map((raw: any) => ({
        id: raw.id,
        household_id: raw.household_id,
        subject: raw.subject,
        content: raw.content,
        type: raw.type,
        status: raw.status,
        occurred_at: raw.occurred_at,
        project_id: raw.project_id,
        project: null, // Not needed for this use case
        tags: raw.interaction_tags?.map((it: any) => ({
          id: it.tag?.id || "",
          name: it.tag?.name || "",
        })).filter((tag: any) => Boolean(tag.id)) || [],
        contacts: raw.interaction_contacts?.map((ic: any) => ({
          id: ic.contact?.id || "",
          first_name: ic.contact?.first_name || "",
          last_name: ic.contact?.last_name || "",
          position: ic.contact?.position || null,
          structure: ic.contact?.structure ? {
            id: ic.contact.structure.id,
            name: ic.contact.structure.name || "",
            type: ic.contact.structure.type || null,
          } : null,
        })).filter((contact: any) => Boolean(contact.id)) || [],
        structures: raw.interaction_structures?.map((is: any) => ({
          id: is.structure?.id || "",
          name: is.structure?.name || "",
          type: is.structure?.type || null,
        })).filter((structure: any) => Boolean(structure.id)) || [],
        metadata: raw.metadata,
        enriched_text: raw.enriched_text,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        created_by: raw.created_by || null,
        updated_by: raw.updated_by || null,
      }));

      setNotes(transformedNotes);

      // Fetch documents for each note
      if (transformedNotes.length > 0) {
        const noteIds = transformedNotes.map(n => n.id);

        const { data: noteDocsData, error: noteDocsError } = await client
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
          .in("interaction_id", noteIds);

        if (noteDocsError) {
          throw new Error(noteDocsError.message);
        }

        // Group documents by note
        const docsByNote: Record<string, Document[]> = {};
        (noteDocsData || []).forEach((row: any) => {
          const docRow = row.document;
          if (!docRow) return;
          const noteId = row.interaction_id;
          if (!noteId) return;

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
            interaction_id: noteId,
            link_role: row.role ?? null,
            link_note: row.note ?? null,
            link_created_at: row.created_at ?? null,
          };

          if (!docsByNote[noteId]) {
            docsByNote[noteId] = [];
          }
          docsByNote[noteId].push(doc);
        });

        setDocumentsByNote(docsByNote);
      } else {
        setDocumentsByNote({});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch project notes";
      setError(message);
      console.error("useProjectNotes error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedHouseholdId]);

  useEffect(() => {
    fetchNotesData();
  }, [fetchNotesData]);

  return {
    notes,
    documentsByNote,
    loading,
    error,
    refetch: fetchNotesData,
  };
}