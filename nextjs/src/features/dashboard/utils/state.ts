import type { DashboardState } from "../types";

export const createInitialDashboardState = (): DashboardState => ({
  summary: [],
  recentInteractions: {
    total: 0,
    items: [],
  },
  todos: [],
  projects: [],
  documents: {
    items: [],
    unlinkedCount: 0,
  },
});
