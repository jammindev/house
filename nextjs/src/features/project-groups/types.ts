export type ProjectGroup = {
  id: string;
  household_id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ProjectGroupMetrics = {
  group_id: string;
  projects_count: number;
  planned_budget: number;
  actual_cost: number;
  open_todos: number;
  done_todos: number;
  documents_count: number;
};

export type ProjectGroupWithMetrics = ProjectGroup & {
  metrics: ProjectGroupMetrics | null;
  projectsCount: number;
  totalTasks: number;
  completionRate: number;
  plannedBudget: number;
  actualCost: number;
  documentsCount: number;
  overBudget: boolean;
  budgetDelta: number;
};

export type CreateProjectGroupInput = {
  householdId: string;
  name: string;
  description?: string | null;
  tags?: string[];
};
