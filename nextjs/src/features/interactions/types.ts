export type ZoneOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

export type InteractionType =
  | "note"
  | "todo"
  | "call"
  | "meeting"
  | "document"
  | "expense"
  | "message"
  | "signature"
  | "other";

export type InteractionStatus = "pending" | "in_progress" | "done" | "archived";

export type TagType = "interaction" | (string & {});

export type Tag = {
  id: string;
  household_id: string;
  type: TagType;
  name: string;
  created_at: string;
  created_by?: string | null;
};

export type InteractionTag = Tag;

export type Interaction = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  type: InteractionType;
  status: InteractionStatus | null;
  occurred_at: string;
  tags: InteractionTag[];
  contact_id?: string | null;
  structure_id?: string | null;
  metadata?: Record<string, unknown> | null;
  enriched_text?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type DocumentType = "document" | "photo" | "quote" | "invoice" | "contract" | "other";

export type DocumentMetadata = {
  size?: number;
  customName?: string;
  [key: string]: unknown;
} | null;

export type Document = {
  id: string;
  household_id: string;
  file_path: string;
  name: string;
  notes: string;
  mime_type: string | null;
  type: DocumentType;
  metadata?: DocumentMetadata;
  created_at: string;
  created_by?: string | null;
  interaction_id?: string;
  link_role?: string | null;
  link_note?: string | null;
  link_created_at?: string | null;
};

export type Preview = { url: string; kind: "image" | "pdf" };
