// nextjs/src/features/interactions/constants.ts
import type { InteractionListFilters, InteractionStatus, InteractionType } from "./types";

export const INTERACTION_TYPES: InteractionType[] = [
  "note",
  "todo",
  "call",
  "meeting",
  "document",
  "expense",
  "visit",
  "quote",
  "message",
  "signature",
  "other",
];

export const INTERACTION_STATUSES: (InteractionStatus | null)[] = [null, "pending", "in_progress", "done", "archived"];

export const INTERACTION_TYPE_COLORS: Record<InteractionType, string> = {
  note: "bg-blue-100 text-blue-800 border-blue-200",
  todo: "bg-purple-100 text-purple-800 border-purple-200",
  call: "bg-green-100 text-green-800 border-green-200",
  meeting: "bg-indigo-100 text-indigo-800 border-indigo-200",
  document: "bg-gray-100 text-gray-800 border-gray-200",
  expense: "bg-red-100 text-red-800 border-red-200",
  visit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  quote: "bg-orange-100 text-orange-800 border-orange-200",
  message: "bg-cyan-100 text-cyan-800 border-cyan-200",
  signature: "bg-pink-100 text-pink-800 border-pink-200",
  other: "bg-slate-100 text-slate-800 border-slate-200",
};

export const DEFAULT_INTERACTION_FILTERS: InteractionListFilters = {
  search: "",
  types: [],
  statuses: [],
  occurredFrom: null,
  occurredTo: null,
};
