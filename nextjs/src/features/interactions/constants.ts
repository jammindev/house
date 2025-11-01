import type { InteractionListFilters, InteractionStatus, InteractionType } from "./types";

export const INTERACTION_TYPES: InteractionType[] = [
  "note",
  "todo",
  "call",
  "meeting",
  "document",
  "expense",
  "artisan_visit",
  "quote",
  "message",
  "signature",
  "other",
];

export const INTERACTION_STATUSES: (InteractionStatus | null)[] = [null, "pending", "in_progress", "done", "archived"];

export const DEFAULT_INTERACTION_FILTERS: InteractionListFilters = {
  search: "",
  statuses: [],
  occurredFrom: null,
  occurredTo: null,
};
