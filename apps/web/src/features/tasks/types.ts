import type { InteractionStatus } from "@interactions/types";

export type TaskStatus = InteractionStatus | null;

export type Task = {
  id: string;
  household_id: string;
  subject: string;
  content: string;
  status: TaskStatus;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  project_id?: string | null;
};

export type TaskColumnId = "backlog" | "pending" | "in_progress" | "done" | "archived";

export type TaskColumnConfig = {
  id: TaskColumnId;
  status: TaskStatus;
};
