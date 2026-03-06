export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'archived' | null;
export type TaskColumnId = 'backlog' | 'pending' | 'in_progress' | 'done';

export interface Task {
  id: string;
  subject: string;
  content: string;
  status: TaskStatus;
  occurred_at: string | null;
  created_at: string;
  project: string | null;
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
    case null: return 'pending';
    case 'pending': return 'in_progress';
    case 'in_progress': return 'done';
    default: return current;
  }
}

export function prevStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case 'pending': return null;
    case 'in_progress': return 'pending';
    case 'done': return 'in_progress';
    default: return current;
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

export async function createTask(
  data: { subject: string; content?: string; occurred_at?: string; zone_ids: string[] },
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

export async function fetchZones(householdId?: string | null): Promise<Zone[]> {
  const res = await fetch('/api/zones/', { headers: buildHeaders(householdId) });
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data)
    ? (data as Zone[])
    : ((data as { results?: Zone[] }).results ?? []);
}
