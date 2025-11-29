export type ProjectStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

export type ProjectPriority = 1 | 2 | 3 | 4 | 5;

export type ProjectType =
  | "renovation"
  | "maintenance"
  | "repair"
  | "purchase"
  | "relocation"
  | "vacation"
  | "leisure"
  | "other";

export type Project = {
  id: string;
  household_id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  type: ProjectType;
  start_date: string | null;
  due_date: string | null;
  closed_at: string | null;
  tags: string[];
  planned_budget: number;
  actual_cost_cached: number;
  cover_interaction_id: string | null;
  project_group_id: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  project_group?: {
    id: string;
    name: string;
  } | null;
};

export type ProjectMetrics = {
  project_id: string;
  open_todos: number;
  done_todos: number;
  documents_count: number;
  actual_cost: number;
};

export type ProjectListFilters = {
  statuses?: ProjectStatus[];
  types?: ProjectType[];
  search?: string;
  tags?: string[];
  startDateFrom?: string | null;
  dueDateTo?: string | null;
  projectGroupId?: string | null;
};

export type ProjectWithMetrics = Project & {
  metrics: ProjectMetrics | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  group: {
    id: string;
    name: string;
    projectsCount?: number;
  } | null;
};
