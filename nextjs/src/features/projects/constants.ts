import type { ProjectPriority, ProjectStatus, ProjectType } from "@projects/types";

export const PROJECT_STATUSES: ProjectStatus[] = ["draft", "active", "on_hold", "completed", "cancelled"];

export const PROJECT_PRIORITY_OPTIONS: { label: string; value: ProjectPriority }[] = [
  { value: 1, label: "priority.highest" },
  { value: 2, label: "priority.higher" },
  { value: 3, label: "priority.medium" },
  { value: 4, label: "priority.lower" },
  { value: 5, label: "priority.lowest" },
];

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

export const PROJECT_TYPES: ProjectType[] = [
  "renovation",
  "maintenance",
  "repair",
  "purchase",
  "relocation",
  "vacation",
  "leisure",
  "other",
];

export type ProjectCardSection = "progress" | "schedule" | "budget" | "tags";

type ProjectTypeDefinition = {
  labelKey: string;
  helperKey: string;
  emptyStateKey?: string;
  suggestedTags: string[];
  defaults: {
    status: ProjectStatus;
    priority: ProjectPriority;
  };
  layout: ProjectCardSection[];
  highlightSections: ProjectCardSection[];
  accent: {
    badge: string;
    footerBg: string;
    footerBorder: string;
    highlight: string;
  };
};

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeDefinition> = {
  renovation: {
    labelKey: "projects.types.renovation.label",
    helperKey: "projects.types.renovation.helper",
    emptyStateKey: "projects.types.renovation.empty",
    suggestedTags: ["paint", "flooring", "permits"],
    defaults: { status: "draft", priority: 3 },
    layout: ["budget", "progress", "schedule", "tags"],
    highlightSections: ["budget", "progress"],
    accent: {
      badge: "bg-amber-50 text-amber-800 border border-amber-200",
      footerBg: "bg-amber-50",
      footerBorder: "border-amber-200",
      highlight: "ring-1 ring-amber-100",
    },
  },
  maintenance: {
    labelKey: "projects.types.maintenance.label",
    helperKey: "projects.types.maintenance.helper",
    emptyStateKey: "projects.types.maintenance.empty",
    suggestedTags: ["seasonal", "filter", "inspection"],
    defaults: { status: "draft", priority: 3 },
    layout: ["progress", "schedule", "budget", "tags"],
    highlightSections: ["progress"],
    accent: {
      badge: "bg-sky-50 text-sky-800 border border-sky-200",
      footerBg: "bg-sky-50",
      footerBorder: "border-sky-200",
      highlight: "ring-1 ring-sky-100",
    },
  },
  repair: {
    labelKey: "projects.types.repair.label",
    helperKey: "projects.types.repair.helper",
    emptyStateKey: "projects.types.repair.empty",
    suggestedTags: ["warranty", "urgent"],
    defaults: { status: "draft", priority: 3 },
    layout: ["progress", "budget", "schedule", "tags"],
    highlightSections: ["progress"],
    accent: {
      badge: "bg-rose-50 text-rose-800 border border-rose-200",
      footerBg: "bg-rose-50",
      footerBorder: "border-rose-200",
      highlight: "ring-1 ring-rose-100",
    },
  },
  purchase: {
    labelKey: "projects.types.purchase.label",
    helperKey: "projects.types.purchase.helper",
    emptyStateKey: "projects.types.purchase.empty",
    suggestedTags: ["vendor", "quote", "delivery"],
    defaults: { status: "draft", priority: 2 },
    layout: ["budget", "progress", "schedule", "tags"],
    highlightSections: ["budget"],
    accent: {
      badge: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      footerBg: "bg-emerald-50",
      footerBorder: "border-emerald-200",
      highlight: "ring-1 ring-emerald-100",
    },
  },
  relocation: {
    labelKey: "projects.types.relocation.label",
    helperKey: "projects.types.relocation.helper",
    emptyStateKey: "projects.types.relocation.empty",
    suggestedTags: ["packing", "storage", "checklist"],
    defaults: { status: "draft", priority: 4 },
    layout: ["schedule", "progress", "budget", "tags"],
    highlightSections: ["schedule"],
    accent: {
      badge: "bg-indigo-50 text-indigo-800 border border-indigo-200",
      footerBg: "bg-indigo-50",
      footerBorder: "border-indigo-200",
      highlight: "ring-1 ring-indigo-100",
    },
  },
  vacation: {
    labelKey: "projects.types.vacation.label",
    helperKey: "projects.types.vacation.helper",
    emptyStateKey: "projects.types.vacation.empty",
    suggestedTags: ["flights", "lodging", "packing"],
    defaults: { status: "draft", priority: 2 },
    layout: ["schedule", "tags", "progress", "budget"],
    highlightSections: ["schedule", "tags"],
    accent: {
      badge: "bg-teal-50 text-teal-800 border border-teal-200",
      footerBg: "bg-teal-50",
      footerBorder: "border-teal-200",
      highlight: "ring-1 ring-teal-100",
    },
  },
  leisure: {
    labelKey: "projects.types.leisure.label",
    helperKey: "projects.types.leisure.helper",
    emptyStateKey: "projects.types.leisure.empty",
    suggestedTags: ["guests", "supplies"],
    defaults: { status: "draft", priority: 2 },
    layout: ["schedule", "tags", "progress", "budget"],
    highlightSections: ["schedule"],
    accent: {
      badge: "bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200",
      footerBg: "bg-fuchsia-50",
      footerBorder: "border-fuchsia-200",
      highlight: "ring-1 ring-fuchsia-100",
    },
  },
  other: {
    labelKey: "projects.types.other.label",
    helperKey: "projects.types.other.helper",
    emptyStateKey: "projects.types.other.empty",
    suggestedTags: [],
    defaults: { status: "draft", priority: 3 },
    layout: ["progress", "schedule", "budget", "tags"],
    highlightSections: [],
    accent: {
      badge: "bg-slate-50 text-slate-700 border border-slate-200",
      footerBg: "bg-slate-50",
      footerBorder: "border-slate-200",
      highlight: "ring-1 ring-slate-200",
    },
  },
};
