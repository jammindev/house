"use client";

import { useCallback, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { InteractionStatus, InteractionType } from "@interactions/types";

type UpdateInteractionInput = {
  subject: string;
  type: InteractionType;
  status: InteractionStatus | null;
  occurredAt: string | null;
  tagIds: string[];
  contactIds: string[];
  structureIds: string[];
  metadata?: Record<string, unknown> | null;
};

export function useUpdateInteraction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateInteraction = useCallback(async (interactionId: string, input: UpdateInteractionInput) => {
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const updatePayload: {
        subject: string;
        type: InteractionType;
        status: InteractionStatus | null;
        occurred_at: string | null;
        metadata?: Record<string, unknown> | null;
      } = {
        subject: input.subject,
        type: input.type,
        status: input.status,
        occurred_at: input.occurredAt ?? null,
      };

      if (input.metadata !== undefined) {
        updatePayload.metadata = input.metadata;
      }

      const { error: updateError } = await client.from("interactions").update(updatePayload).eq("id", interactionId);
      if (updateError) throw updateError;

      const tagIds = Array.from(new Set(input.tagIds));
      const contactIds = Array.from(new Set(input.contactIds));
      const structureIds = Array.from(new Set(input.structureIds));

      const { error: deleteTagsError } = await client.from("interaction_tags").delete().eq("interaction_id", interactionId);
      if (deleteTagsError) throw deleteTagsError;
      if (tagIds.length > 0) {
        const { error: insertTagsError } = await client
          .from("interaction_tags")
          .insert(tagIds.map((tagId) => ({ interaction_id: interactionId, tag_id: tagId })));
        if (insertTagsError) throw insertTagsError;
      }

      const { error: deleteContactsError } = await client
        .from("interaction_contacts")
        .delete()
        .eq("interaction_id", interactionId);
      if (deleteContactsError) throw deleteContactsError;
      if (contactIds.length > 0) {
        const { error: insertContactsError } = await client
          .from("interaction_contacts")
          .insert(contactIds.map((contactId) => ({ interaction_id: interactionId, contact_id: contactId })));
        if (insertContactsError) throw insertContactsError;
      }

      const { error: deleteStructuresError } = await client
        .from("interaction_structures")
        .delete()
        .eq("interaction_id", interactionId);
      if (deleteStructuresError) throw deleteStructuresError;
      if (structureIds.length > 0) {
        const { error: insertStructuresError } = await client
          .from("interaction_structures")
          .insert(structureIds.map((structureId) => ({ interaction_id: interactionId, structure_id: structureId })));
        if (insertStructuresError) throw insertStructuresError;
      }
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to update interaction";
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateInteraction, loading, error, setError };
}
