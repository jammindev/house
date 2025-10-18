import type { InteractionStatus, InteractionType } from "./types";

export const INTERACTION_TYPES: InteractionType[] = [
  "note",
  "todo",
  "call",
  "meeting",
  "document",
  "expense",
  "message",
  "signature",
  "other",
];

export const INTERACTION_STATUSES: (InteractionStatus | null)[] = [null, "pending", "in_progress", "done", "archived"];
