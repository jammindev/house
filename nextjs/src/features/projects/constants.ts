import type { ProjectPriority, ProjectStatus } from "@projects/types";

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
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
