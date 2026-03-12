export type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'done' | 'archived' | null;
export type TaskColumnId = 'backlog' | 'pending' | 'in_progress' | 'done';

export interface Task {
  id: string;
  subject: string;
  content: string;
  status: TaskStatus;
  occurred_at: string | null;
  created_at: string;
  project: string | null;
  project_title?: string | null;
  zone_names: string[];
  metadata: Record<string, unknown>;
  document_count: number;
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
  if (!task.occurred_at) return false;
  if (task.status === 'done' || task.status === 'archived') return false;
  const due = new Date(task.occurred_at);
  const today = new Date();
  // Comparaison par jour uniquement — une tâche est en retard si sa date est STRICTEMENT avant aujourd'hui
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

function buildHeaders(householdId?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-CSRFToken': getCsrfToken(),
    ...(householdId ? { 'X-Household-Id': householdId } : {}),
  };
}

export async function fetchTasks(householdId?: string | null): Promise<Task[]> {
  const res = await fetch(
    '/api/interactions/interactions/?type=todo&limit=200&ordering=occurred_at',
    { headers: buildHeaders(householdId) },
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
  householdId?: string | null,
): Promise<Task> {
  const res = await fetch(`/api/interactions/interactions/${id}/`, {
    method: 'PATCH',
    headers: { ...buildHeaders(householdId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function updateTask(
  id: string,
  data: { subject?: string; content?: string; occurred_at?: string; zone_ids?: string[] },
  householdId?: string | null,
): Promise<Task> {
  const res = await fetch(`/api/interactions/interactions/${id}/`, {
    method: 'PATCH',
    headers: { ...buildHeaders(householdId), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function createTask(
  data: { subject: string; content?: string; occurred_at?: string; zone_ids: string[]; metadata?: Record<string, unknown> },
  householdId?: string | null,
): Promise<Task> {
  const res = await fetch('/api/interactions/interactions/', {
    method: 'POST',
    headers: { ...buildHeaders(householdId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'todo', status: 'pending', ...data }),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return (await res.json()) as Task;
}

export async function deleteTask(id: string, householdId?: string | null): Promise<void> {
  const res = await fetch(`/api/interactions/interactions/${id}/`, {
    method: 'DELETE',
    headers: buildHeaders(householdId),
  });
  // 404 = already deleted — treat as success (idempotent DELETE)
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete task: ${res.status}`);
}

export async function fetchZones(householdId?: string | null): Promise<Zone[]> {
  const res = await fetch('/api/zones/', { headers: buildHeaders(householdId) });
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data)
    ? (data as Zone[])
    : ((data as { results?: Zone[] }).results ?? []);
}
