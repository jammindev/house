import type { DocumentWithLinks } from "@documents/types";
import type { ProjectWithMetrics } from "@projects/types";

export type DashboardSummaryMetricKey = "interactions" | "contacts" | "zones";

export type DashboardSummaryMetric = {
  key: DashboardSummaryMetricKey;
  total: number;
  labelKey: string;
  descriptionKey?: string;
};

export type DashboardRecentInteraction = {
  id: string;
  subject: string | null;
  content: string | null;
  occurredAt: string | null;
  createdAt: string;
  type: string | null;
};

export type DashboardRecentInteractions = {
  total: number;
  items: DashboardRecentInteraction[];
};

export type DashboardTodoItem = {
  id: string;
  subject: string | null;
  status: string | null;
  occurredAt: string | null;
  createdAt: string;
  isOverdue: boolean;
  isDueSoon: boolean;
};

export type DashboardDocuments<TDocument> = {
  items: TDocument[];
  unlinkedCount: number;
};

export type DashboardData<TDocument, TProject> = {
  summary: DashboardSummaryMetric[];
  recentInteractions: DashboardRecentInteractions;
  todos: DashboardTodoItem[];
  projects: TProject[];
  documents: DashboardDocuments<TDocument>;
};

export type DashboardHookResult<TDocument, TProject> = DashboardData<TDocument, TProject> & {
  loading: boolean;
  error: string | null;
};

export type DashboardDocumentItem = DocumentWithLinks & {
  hasLinks: boolean;
};

export type DashboardProjectSummary = ProjectWithMetrics;

export type DashboardState = DashboardData<DashboardDocumentItem, DashboardProjectSummary>;

export type DashboardResult = DashboardHookResult<DashboardDocumentItem, DashboardProjectSummary>;
