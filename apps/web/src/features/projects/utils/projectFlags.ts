import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

export type ProjectFlagResult = Pick<ProjectWithMetrics, "isDueSoon" | "isOverdue">;

export function computeProjectFlags(project: Project, metrics: ProjectMetrics | null): ProjectFlagResult {
  const base: ProjectFlagResult = {
    isDueSoon: false,
    isOverdue: false,
  };

  if (!project.due_date || project.status === "completed" || project.status === "cancelled") {
    return base;
  }

  const due = new Date(project.due_date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const openTodos = metrics?.open_todos ?? 0;
  if (openTodos <= 0) {
    return base;
  }

  const delta = (due.getTime() - today.getTime()) / MS_IN_DAY;

  return {
    isOverdue: due < today,
    isDueSoon: delta >= 0 && delta <= 7,
  };
}
