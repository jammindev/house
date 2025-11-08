import type { Document, DocumentType } from "@interactions/types";

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

export type StagedFile = {
  id: string;
  file: File;
  name: string;
  type: DocumentType;
};

export type DocumentUploadResult = {
  success: boolean;
  uploadedIds: string[];
  error?: string;
};
