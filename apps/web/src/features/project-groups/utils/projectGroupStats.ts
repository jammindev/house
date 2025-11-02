import type { ProjectGroup, ProjectGroupMetrics, ProjectGroupWithMetrics } from "@project-groups/types";

export const computeProjectGroupSnapshot = (
  base: ProjectGroup,
  metrics: ProjectGroupMetrics | null
): ProjectGroupWithMetrics => {
  const openTodos = metrics?.open_todos ?? 0;
  const doneTodos = metrics?.done_todos ?? 0;
  const totalTasks = openTodos + doneTodos;
  const plannedBudget = metrics?.planned_budget ?? 0;
  const actualCost = metrics?.actual_cost ?? 0;
  const documentsCount = metrics?.documents_count ?? 0;
  const projectsCount = metrics?.projects_count ?? 0;
  const completionRate = totalTasks > 0 ? doneTodos / totalTasks : 0;
  const budgetDelta = actualCost - plannedBudget;

  return {
    ...base,
    metrics,
    projectsCount,
    totalTasks,
    completionRate,
    plannedBudget,
    actualCost,
    documentsCount,
    overBudget: actualCost > plannedBudget,
    budgetDelta,
  };
};
