import type { ProjectPriority, ProjectStatus, ProjectType } from "@projects/types";

export type ProjectIntakeStep =
  | "title"
  | "type"
  | "startDate"
  | "dueDate"
  | "plannedBudget"
  | "tags"
  | "description";

export type ProjectIntakeDraft = {
  title: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  dueDate: string | null;
  plannedBudget: number | null;
  tags: string[];
};

export type ProjectIntakeRequest = {
  householdId: string;
  locale?: string;
  step?: ProjectIntakeStep | null;
  nextStep?: ProjectIntakeStep | null;
  latestAnswer?: string;
  draft: ProjectIntakeDraft;
};

export type ProjectIntakeResponse = {
  message: string;
  fallbackUsed?: boolean;
  error?: string;
};
