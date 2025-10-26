import type { Document } from "@interactions/types";

type SupabaseInteractionLink = {
  interaction_id: string;
  interaction?: {
    id: string;
    subject: string | null;
  } | null;
};

export type DocumentLink = {
  interactionId: string;
  subject: string | null;
};

export type DocumentWithLinks = Document & {
  links: DocumentLink[];
};

export type SupabaseDocumentRow = Document & {
  interaction_documents?: SupabaseInteractionLink[] | null;
};
