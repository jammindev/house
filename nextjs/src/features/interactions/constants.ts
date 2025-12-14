// nextjs/src/features/interactions/constants.ts
import { z } from "zod";

import type { InteractionListFilters, InteractionStatus, InteractionType } from "./types";

export const INTERACTION_TYPES: InteractionType[] = [
  "note",
  "todo",
  "call",
  "meeting",
  "document",
  "expense",
  "maintenance",
  "repair",
  "installation",
  "inspection",
  "issue",
  "warranty",
  "replacement",
  "upgrade",
  "visit",
  "disposal",
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
  maintenance: "bg-emerald-100 text-emerald-800 border-emerald-200",
  repair: "bg-orange-100 text-orange-800 border-orange-200",
  installation: "bg-sky-100 text-sky-800 border-sky-200",
  inspection: "bg-amber-100 text-amber-800 border-amber-200",
  issue: "bg-rose-100 text-rose-800 border-rose-200",
  warranty: "bg-cyan-100 text-cyan-800 border-cyan-200",
  replacement: "bg-indigo-100 text-indigo-800 border-indigo-200",
  upgrade: "bg-purple-100 text-purple-800 border-purple-200",
  visit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  disposal: "bg-gray-100 text-gray-800 border-gray-200",
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

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

export type InteractionSubjectStrategy = "manual" | "auto";

export type InteractionRequiredAssociations = {
  zones: boolean;
  contactsOrStructures: boolean;
  projectOrEquipmentExclusive: boolean;
};

export type InteractionFormStep = {
  id: string;
  title: string;
  description?: string;
};

export type InteractionFormUiConfig = {
  contextStepIndex?: number;
  attachmentsStepIndex?: number;
};

export type InteractionFormConfig<TMetadata = unknown> = {
  type: InteractionType;
  steps: (t: TranslationFn) => InteractionFormStep[];
  subjectStrategy: InteractionSubjectStrategy;
  requiredAssociations: InteractionRequiredAssociations;
  metadataSchema: z.ZodType<TMetadata | null | undefined>;
  ui?: InteractionFormUiConfig;
};

const noteMetadataSchema = z
  .object({
    equipment_id: z.string().uuid().optional(),
    source: z.literal("note_form").optional(),
  })
  .nullable()
  .optional();

export const INTERACTION_FORM_CONFIG: Partial<Record<InteractionType, InteractionFormConfig>> = {
  note: {
    type: "note",
    subjectStrategy: "manual",
    requiredAssociations: {
      zones: true,
      contactsOrStructures: false,
      projectOrEquipmentExclusive: true,
    },
    steps: (t) => [
      { id: "basics", title: t("forms.note.steps.basics"), description: t("forms.note.steps.basicsDescription") },
      { id: "scope", title: t("forms.note.steps.scope"), description: t("forms.note.steps.scopeDescription") },
      { id: "context", title: t("forms.note.steps.context"), description: t("forms.note.steps.contextDescription") },
      {
        id: "attachments",
        title: t("forms.note.steps.attachments"),
        description: t("forms.note.steps.attachmentsDescription"),
      },
    ],
    metadataSchema: noteMetadataSchema,
    ui: {
      contextStepIndex: 2,
      attachmentsStepIndex: 3,
    },
  },
};
