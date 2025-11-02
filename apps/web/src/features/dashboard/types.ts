import type { Document, Interaction, InteractionStatus } from "@interactions/types";
import type { ProjectStatus, ProjectWithMetrics } from "@projects/types";

type InteractionProject = {
  id: string;
  title: string;
  status: ProjectStatus;
} | null;

export type DashboardSummaryMetrics = {
  interactions: number;
  contacts: number;
  zones: number;
  documents: number;
};

export type DashboardInteraction = Pick<
  Interaction,
  "id" | "subject" | "content" | "type" | "status" | "occurred_at" | "created_at"
> & {
  project: InteractionProject;
};

export type DashboardTask = {
  id: string;
  subject: string;
  status: InteractionStatus | null;
  occurred_at: string | null;
  created_at: string;
  project: InteractionProject;
};

type DocumentLink = {
  interactionId: string;
  subject: string | null;
};

export type DashboardDocument = Pick<
  Document,
  "id" | "name" | "notes" | "type" | "created_at" | "metadata" | "household_id"
> & {
  links: DocumentLink[];
};

export type DashboardData = {
  summary: DashboardSummaryMetrics | null;
  recentInteractions: DashboardInteraction[];
  tasks: DashboardTask[];
  highlightProjects: ProjectWithMetrics[];
  documents: DashboardDocument[];
};
