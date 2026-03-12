export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType =
  | 'renovation'
  | 'maintenance'
  | 'repair'
  | 'purchase'
  | 'relocation'
  | 'vacation'
  | 'leisure'
  | 'other';

export interface ProjectZoneItem {
  id: string;
  name: string;
  color?: string | null;
}

export interface ProjectListItem {
  id: string;
  household: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: number;
  type: ProjectType;
  start_date: string | null;
  due_date: string | null;
  closed_at: string | null;
  tags: string[];
  planned_budget: string;
  actual_cost_cached: string;
  cover_interaction: string | null;
  project_group: string | null;
  project_group_name: string | null;
  is_pinned: boolean;
  zones: ProjectZoneItem[];
  created_at: string;
  updated_at: string;
}

export interface ProjectGroupItem {
  id: string;
  household: string;
  name: string;
  description: string;
  tags: string[];
  projects_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectPayload {
  title: string;
  description?: string;
  status?: ProjectStatus;
  priority?: number;
  type?: ProjectType;
  start_date?: string | null;
  due_date?: string | null;
  planned_budget?: number;
  tags?: string[];
  project_group?: string | null;
}

export interface ProjectGroupPayload {
  name: string;
  description?: string;
  tags?: string[];
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function buildHeaders(withJson = false) {
  const csrfToken = getCookie('csrftoken');
  return {
    Accept: 'application/json',
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
  };
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

// ── Projects ───────────────────────────────────────────────

interface FetchProjectsOptions {
  search?: string;
  status?: string;
  type?: string;
  zone?: string;
  groupId?: string;
  ordering?: string;
  limit?: number;
  offset?: number;
}

export async function fetchProjects(options: FetchProjectsOptions = {}): Promise<ProjectListItem[]> {
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);
  if (options.type) params.set('type', options.type);
  if (options.zone) params.set('zone', options.zone);
  if (options.groupId) params.set('project_group', options.groupId);
  params.set('ordering', options.ordering ?? '-updated_at');
  params.set('limit', String(options.limit ?? 200));
  if (options.offset) params.set('offset', String(options.offset));

  const response = await fetch(`/api/projects/projects/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const payload = (await response.json()) as unknown;
  return normalizeList<ProjectListItem>(payload);
}

export async function fetchProject(id: string): Promise<ProjectListItem> {
  const response = await fetch(`/api/projects/projects/${id}/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectListItem;
}

export async function createProject(input: ProjectPayload): Promise<ProjectListItem> {
  const response = await fetch('/api/projects/projects/', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true),
    body: JSON.stringify({
      ...input,
      description: input.description ?? '',
      tags: input.tags ?? [],
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      project_group: input.project_group || null,
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectListItem;
}

export async function updateProject(id: string, input: Partial<ProjectPayload>): Promise<ProjectListItem> {
  const response = await fetch(`/api/projects/projects/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(true),
    body: JSON.stringify({
      ...input,
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(typeof input.start_date !== 'undefined' ? { start_date: input.start_date || null } : {}),
      ...(typeof input.due_date !== 'undefined' ? { due_date: input.due_date || null } : {}),
      ...(typeof input.project_group !== 'undefined' ? { project_group: input.project_group || null } : {}),
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectListItem;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/projects/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
}

export async function pinProject(id: string): Promise<ProjectListItem> {
  const response = await fetch(`/api/projects/projects/${id}/pin/`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectListItem;
}

export async function unpinProject(id: string): Promise<ProjectListItem> {
  const response = await fetch(`/api/projects/projects/${id}/unpin/`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectListItem;
}

// ── Project Groups ─────────────────────────────────────────

export async function fetchProjectGroups(): Promise<ProjectGroupItem[]> {
  const response = await fetch('/api/projects/project-groups/', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const payload = (await response.json()) as unknown;
  return normalizeList<ProjectGroupItem>(payload);
}

export async function fetchProjectGroup(id: string): Promise<ProjectGroupItem> {
  const response = await fetch(`/api/projects/project-groups/${id}/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectGroupItem;
}

export async function createProjectGroup(input: ProjectGroupPayload): Promise<ProjectGroupItem> {
  const response = await fetch('/api/projects/project-groups/', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true),
    body: JSON.stringify({ ...input, description: input.description ?? '', tags: input.tags ?? [] }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectGroupItem;
}

export async function updateProjectGroup(id: string, input: Partial<ProjectGroupPayload>): Promise<ProjectGroupItem> {
  const response = await fetch(`/api/projects/project-groups/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as ProjectGroupItem;
}

export async function deleteProjectGroup(id: string): Promise<void> {
  const response = await fetch(`/api/projects/project-groups/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
}
