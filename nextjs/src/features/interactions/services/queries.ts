// nextjs/src/features/interactions/services/queries.ts
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type {
    RawInteractionQuery,
    RawInteractionDocumentQuery,
    UpdateInteractionInput,
    DbInteraction,
} from "./types";
import type { InteractionType, InteractionStatus } from "@interactions/types";

/**
 * Database query functions for interactions
 */
export class InteractionQueries {
    /**
     * Get Supabase client instance
     */
    private static async getClient() {
        const supa = await createSPASassClient();
        return supa.getSupabaseClient();
    }

    /**
     * Fetch a single interaction with all related data
     */
    static async fetchInteractionById(id: string): Promise<{
        interactionData: RawInteractionQuery | null;
        documentData: RawInteractionDocumentQuery[];
    }> {
        const client = await this.getClient();

        // Fetch interaction with all relations
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
              emails:emails(
                id,
                email,
                label,
                is_primary,
                created_at
              ),
              phones:phones(
                id,
                phone,
                label,
                is_primary,
                created_at
              ),
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
              type,
              emails:emails!emails_structure_id_fkey(
                id,
                email,
                label,
                is_primary,
                created_at
              ),
              phones:phones!phones_structure_id_fkey(
                id,
                phone,
                label,
                is_primary,
                created_at
              )
            )
          ),
          project:projects!interactions_project_id_fkey(
            id,
            title,
            status
          )
        `
            )
            .eq("id", id)
            .single();

        if (interactionError) {
            throw new Error(`Failed to fetch interaction: ${interactionError.message}`);
        }

        // Fetch interaction documents
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

        if (documentError) {
            throw new Error(`Failed to fetch interaction documents: ${documentError.message}`);
        }

        return {
            interactionData: interactionData as RawInteractionQuery | null,
            documentData: documentData as RawInteractionDocumentQuery[],
        };
    }

    /**
     * Update an interaction record
     */
    static async updateInteraction(interactionId: string, input: UpdateInteractionInput): Promise<void> {
        const client = await this.getClient();

        const updatePayload: {
            subject: string;
            type: InteractionType;
            status: InteractionStatus | null;
            occurred_at: string | undefined;
            metadata?: any;
            project_id: string | null;
        } = {
            subject: input.subject,
            type: input.type,
            status: input.status,
            occurred_at: input.occurredAt ?? undefined,
            project_id: input.projectId ?? null,
        };

        if (input.metadata !== undefined) {
            updatePayload.metadata = input.metadata;
        }

        const { error: updateError } = await client
            .from("interactions")
            .update(updatePayload)
            .eq("id", interactionId);

        if (updateError) {
            throw new Error(`Failed to update interaction: ${updateError.message}`);
        }
    }

    /**
     * Update interaction tags
     */
    static async updateInteractionTags(interactionId: string, tagIds: string[]): Promise<void> {
        const client = await this.getClient();
        const uniqueTagIds = Array.from(new Set(tagIds));

        // Delete existing tags
        const { error: deleteTagsError } = await client
            .from("interaction_tags")
            .delete()
            .eq("interaction_id", interactionId);

        if (deleteTagsError) {
            throw new Error(`Failed to delete interaction tags: ${deleteTagsError.message}`);
        }

        // Insert new tags
        if (uniqueTagIds.length > 0) {
            const { error: insertTagsError } = await client
                .from("interaction_tags")
                .insert(uniqueTagIds.map((tagId) => ({ interaction_id: interactionId, tag_id: tagId })));

            if (insertTagsError) {
                throw new Error(`Failed to insert interaction tags: ${insertTagsError.message}`);
            }
        }
    }

    /**
     * Update interaction contacts
     */
    static async updateInteractionContacts(interactionId: string, contactIds: string[]): Promise<void> {
        const client = await this.getClient();
        const uniqueContactIds = Array.from(new Set(contactIds));

        // Delete existing contacts
        const { error: deleteContactsError } = await client
            .from("interaction_contacts")
            .delete()
            .eq("interaction_id", interactionId);

        if (deleteContactsError) {
            throw new Error(`Failed to delete interaction contacts: ${deleteContactsError.message}`);
        }

        // Insert new contacts
        if (uniqueContactIds.length > 0) {
            const { error: insertContactsError } = await client
                .from("interaction_contacts")
                .insert(uniqueContactIds.map((contactId) => ({ interaction_id: interactionId, contact_id: contactId })));

            if (insertContactsError) {
                throw new Error(`Failed to insert interaction contacts: ${insertContactsError.message}`);
            }
        }
    }

    /**
     * Update interaction structures
     */
    static async updateInteractionStructures(interactionId: string, structureIds: string[]): Promise<void> {
        const client = await this.getClient();
        const uniqueStructureIds = Array.from(new Set(structureIds));

        // Delete existing structures
        const { error: deleteStructuresError } = await client
            .from("interaction_structures")
            .delete()
            .eq("interaction_id", interactionId);

        if (deleteStructuresError) {
            throw new Error(`Failed to delete interaction structures: ${deleteStructuresError.message}`);
        }

        // Insert new structures
        if (uniqueStructureIds.length > 0) {
            const { error: insertStructuresError } = await client
                .from("interaction_structures")
                .insert(uniqueStructureIds.map((structureId) => ({ interaction_id: interactionId, structure_id: structureId })));

            if (insertStructuresError) {
                throw new Error(`Failed to insert interaction structures: ${insertStructuresError.message}`);
            }
        }
    }

    /**
     * Delete an interaction
     */
    static async deleteInteraction(interactionId: string): Promise<void> {
        const client = await this.getClient();

        const { error } = await client
            .from("interactions")
            .delete()
            .eq("id", interactionId);

        if (error) {
            throw new Error(`Failed to delete interaction: ${error.message}`);
        }
    }
}