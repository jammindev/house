import { api } from '@/lib/axios';

export type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'done' | 'archived' | null;
export type TaskColumnId = 'backlog' | 'pending' | 'in_progress' | 'done';
export type TaskPriority = 1 | 2 | 3 | null;

export interface Task {
  id: string;
  subject: string;
  content: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;           // YYYY-MM-DD
  is_private: boolean;
  assigned_to: string | null;        // UUID user assigné
  assigned_to_name: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
  project: string | null;
  project_title?: string | null;
  zone_names: string[];
  source_interaction: string | null;
}

export interface HouseholdMember {
  userId: string;
  name: string;
  role: 'owner' | 'member';
}

export interface Zone {
  id: string;
  name: string;
}

export const COLUMN_SEQUENCE: TaskColumnId[] = ['backlog', 'pending', 'in_progress', 'done'];

export function statusToColumnId(status: TaskStatus): TaskColumnId {
  switch (status) {
    case 'pending': return 'pending';
    case 'in_progress': return 'in_progress';
    case 'done': return 'done';
    default: return 'backlog';
  }
}

export function groupTasksByColumn(tasks: Task[]): Record<TaskColumnId, Task[]> {
  const grouped: Record<TaskColumnId, Task[]> = {
    backlog: [],
    pending: [],
    in_progress: [],
    done: [],
  };
  for (const task of tasks) {
    grouped[statusToColumnId(task.status)].push(task);
  }
  return grouped;
}


export function isTaskOverdue(task: Task): boolean {
  if (!task.due_date) return false;
  if (task.status === 'done' || task.status === 'archived') return false;
  const due = new Date(task.due_date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(diffDays) < 1) return rtf.format(0, 'day');
    return rtf.format(diffDays, 'day');
  } catch {
    return date.toLocaleDateString();
  }
}

export async function fetchTasks(): Promise<Task[]> {
  const { data } = await api.get('/tasks/tasks/', {
    params: { limit: 200, ordering: 'due_date,created_at' },
  });
  return Array.isArray(data)
    ? (data as Task[])
    : ((data as { results?: Task[] }).results ?? []);
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  const { data } = await api.patch(`/tasks/tasks/${id}/`, { status });
  return data as Task;
}

export async function updateTask(
  id: string,
  payload: {
    subject?: string;
    content?: string;
    zone_ids?: string[];
    due_date?: string | null;
    priority?: TaskPriority;
    assigned_to_id?: string | null;
    status?: TaskStatus;
    project?: string | null;
    is_private?: boolean;
  },
): Promise<Task> {
  const { data } = await api.patch(`/tasks/tasks/${id}/`, payload);
  return data as Task;
}

export async function createTask(
  payload: {
    subject: string;
    content?: string;
    zone_ids: string[];
    due_date?: string | null;
    priority?: TaskPriority;
    assigned_to_id?: string | null;
    status?: TaskStatus;
    project?: string | null;
    is_private?: boolean;
  },
): Promise<Task> {
  const { data } = await api.post('/tasks/tasks/', { status: 'pending', ...payload });
  return data as Task;
}

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const { data } = await api.get('/tasks/tasks/', {
    params: { project: projectId, limit: 200, ordering: 'due_date,created_at' },
  });
  return Array.isArray(data)
    ? (data as Task[])
    : ((data as { results?: Task[] }).results ?? []);
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/tasks/${id}/`);
}

export async function fetchZones(): Promise<Zone[]> {
  const { data } = await api.get('/zones/');
  return Array.isArray(data)
    ? (data as Zone[])
    : ((data as { results?: Zone[] }).results ?? []);
}

export async function fetchHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data } = await api.get('/households/active-members/');
  const list = Array.isArray(data) ? data : [];
  return (list as Array<{ user: string; user_display_name: string; role: string }>).map((m) => ({
    userId: m.user,
    name: m.user_display_name,
    role: m.role as HouseholdMember['role'],
  }));
}
