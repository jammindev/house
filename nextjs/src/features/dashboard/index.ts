export { default as DashboardTasksPanel } from "./components/DashboardTasksPanel";
export { default as DashboardProjectsPanel } from "./components/DashboardProjectsPanel";
export { default as DashboardDocumentsPanel } from "./components/DashboardDocumentsPanel";
export { default as DashboardActivityFeed } from "./components/DashboardActivityFeed";
export { default as DashboardQuickActions } from "./components/DashboardQuickActions";
export { default as DashboardInProgressPanel } from "./components/DashboardInProgressPanel";
export { default as DashboardProjectsByGroups } from "./components/DashboardProjectsByGroups";
export { useDashboardData } from "./hooks/useDashboardData";
export type {
  DashboardData,
  DashboardDocument,
  DashboardInteraction,
  DashboardSummaryMetrics,
  DashboardTask,
} from "./types";
