// nextjs/src/features/interactions/services/types.ts
import type { Tables, Json } from "@/lib/types-generated";
import type {
    InteractionStatus,
    InteractionType,
} from "@interactions/types";

// Input types for service operations
export type UpdateInteractionInput = {
    subject: string;
    type: InteractionType;
    status: InteractionStatus | null;
    occurredAt: string | null;
    projectId?: string | null;
    tagIds: string[];
    contactIds: string[];
    structureIds: string[];
    metadata?: Json | null;
};

// Type aliases from generated types for better readability
export type DbInteraction = Tables<"interactions">;
export type DbDocument = Tables<"documents">;
export type DbContact = Tables<"contacts">;
export type DbStructure = Tables<"structures">;
export type DbEmail = Tables<"emails">;
export type DbPhone = Tables<"phones">;
export type DbTag = Tables<"tags">;
export type DbProject = Tables<"projects">;

// Raw query result types based on the complex joins
export type RawInteractionQuery = DbInteraction & {
    interaction_tags?: Array<{
        tag?: DbTag | null;
    }> | null;
    interaction_contacts?: Array<{
        contact?: (DbContact & {
            emails?: DbEmail[] | null;
            phones?: DbPhone[] | null;
            structure?: DbStructure | null;
        }) | null;
    }> | null;
    interaction_structures?: Array<{
        structure?: (DbStructure & {
            emails?: DbEmail[] | null;
            phones?: DbPhone[] | null;
        }) | null;
    }> | null;
    project?: Pick<DbProject, "id" | "title" | "status"> | null;
};

export type RawInteractionDocumentQuery = {
    interaction_id: string;
    role: string | null;
    note: string | null;
    created_at: string;
    document: DbDocument | null;
};