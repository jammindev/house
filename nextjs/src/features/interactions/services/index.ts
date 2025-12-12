// nextjs/src/features/interactions/services/index.ts
export { InteractionService } from "./interactionService";
export { InteractionQueries } from "./queries";
export { InteractionTransformers } from "./transformers";
export { InteractionServiceUtils } from "./utils";

// Export types
export type { UpdateInteractionInput } from "./types";
export type {
    DbInteraction,
    DbDocument,
    DbContact,
    DbStructure,
    DbEmail,
    DbPhone,
    DbTag,
    DbProject,
    RawInteractionQuery,
    RawInteractionDocumentQuery,
} from "./types";

// Re-export Json type for convenience
export type { Json } from "@/lib/types-generated";