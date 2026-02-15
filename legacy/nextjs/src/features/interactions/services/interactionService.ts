// nextjs/src/features/interactions/services/interactionService.ts
import type { Document, Interaction } from "@interactions/types";
import type { UpdateInteractionInput } from "./types";
import { InteractionQueries } from "./queries";
import { InteractionTransformers } from "./transformers";

/**
 * Interaction Service - Main orchestrator for interaction operations
 * Coordinates queries and transformations for interaction data
 */
export class InteractionService {
  /**
   * Fetch a single interaction with all related data
   */
  static async getInteractionById(id: string): Promise<{
    interaction: Interaction | null;
    documents: Document[];
  }> {
    const { interactionData, documentData } = await InteractionQueries.fetchInteractionById(id);

    const interaction = interactionData 
      ? InteractionTransformers.transformRawInteraction(interactionData) 
      : null;
    
    const documents = InteractionTransformers.transformRawDocuments(documentData);

    return { interaction, documents };
  }

  /**
   * Update an interaction with related data
   */
  static async updateInteractionById(interactionId: string, input: UpdateInteractionInput): Promise<void> {
    // Update the main interaction record
    await InteractionQueries.updateInteraction(interactionId, input);

    // Update related data
    await Promise.all([
      InteractionQueries.updateInteractionTags(interactionId, input.tagIds),
      InteractionQueries.updateInteractionContacts(interactionId, input.contactIds),
      InteractionQueries.updateInteractionStructures(interactionId, input.structureIds),
    ]);
  }

  /**
   * Delete an interaction
   */
  static async deleteInteractionById(interactionId: string): Promise<void> {
    await InteractionQueries.deleteInteraction(interactionId);
  }
}