import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import type { Task, TaskStatus } from '@/lib/api/tasks';
import { updateTaskStatus } from '@/lib/api/tasks';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardProject {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
}

export interface DashboardInteraction {
  id: string;
  subject: string;
  type: string;
  occurred_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const p = data as { results?: T[] };
  return Array.isArray(p.results) ? p.results : [];
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  myWeek: () => [...dashboardKeys.all, 'my-week'] as const,
  activity: () => [...dashboardKeys.all, 'activity'] as const,
  projects: () => [...dashboardKeys.all, 'projects'] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Pending tasks due within the next 7 days (overdue ones live in the triage block). */
export function useMyWeekTasks() {
  return useQuery({
    queryKey: dashboardKeys.myWeek(),
    queryFn: async () => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const { data } = await api.get('/tasks/tasks/', {
        params: { status: 'pending', due_before: isoDate(horizon), limit: 20 },
      });
      const today = isoDate(new Date());
      return normalizeList<Task>(data).filter(
        (task) => task.due_date !== null && task.due_date >= today,
      );
    },
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: async () => {
      const { data } = await api.get('/interactions/interactions/', { params: { limit: 6 } });
      return normalizeList<DashboardInteraction>(data);
    },
  });
}

export function useActiveProjects() {
  return useQuery({
    queryKey: dashboardKeys.projects(),
    queryFn: async () => {
      const { data } = await api.get('/projects/projects/', {
        params: { status: 'active', limit: 5 },
      });
      return normalizeList<DashboardProject>(data);
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Status toggle for "My week" checkboxes — invalidates both dashboard and tasks caches. */
export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTaskStatus(id, status),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dashboardKeys.myWeek() });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
