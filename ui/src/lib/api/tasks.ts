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

export function nextStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case null:
    case 'backlog': return 'pending';
    case 'pending': return 'in_progress';
    case 'in_progress': return 'done';
    default: return current;
  }
}

export function prevStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case 'done': return 'in_progress';
    default: return current;
  }
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

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

function buildHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-CSRFToken': getCsrfToken(),
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(
    '/api/tasks/tasks/?limit=200&ordering=due_date,created_at',
    { headers: buildHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data)
    ? (data as Task[])
    : ((data as { results?: Task[] }).results ?? []);
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  const res = await fetch(`/api/tasks/tasks/${id}/`, {
    method: 'PATCH',
    headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function updateTask(
  id: string,
  data: {
    subject?: string;
    content?: string;
    zone_ids?: string[];
    due_date?: string | null;
    priority?: TaskPriority;
    assigned_to_id?: string | null;
    status?: TaskStatus;
  },
): Promise<Task> {
  const res = await fetch(`/api/tasks/tasks/${id}/`, {
    method: 'PATCH',
    headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function createTask(
  data: {
    subject: string;
    content?: string;
    zone_ids: string[];
    due_date?: string | null;
    priority?: TaskPriority;
    assigned_to_id?: string | null;
  },
): Promise<Task> {
  const res = await fetch('/api/tasks/tasks/', {
    method: 'POST',
    headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'pending', ...data }),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/tasks/${id}/`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete task: ${res.status}`);
}

export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch('/api/zones/', { headers: buildHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data)
    ? (data as Zone[])
    : ((data as { results?: Zone[] }).results ?? []);
}

export async function fetchHouseholdMembers(): Promise<HouseholdMember[]> {
  const res = await fetch('/api/households/active-members/', { headers: buildHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`);
  const data = (await res.json()) as Array<{ user: string; user_display_name: string; role: string }>;
  return (Array.isArray(data) ? data : []).map((m) => ({
    userId: m.user,
    name: m.user_display_name,
    role: m.role as HouseholdMember['role'],
  }));
}
