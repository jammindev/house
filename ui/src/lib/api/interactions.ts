export interface InteractionListItem {
  id: string;
  subject: string;
  content: string;
  type: string;
  status: string | null;
  occurred_at: string;
  tags: string[];
  zone_names: string[];
  document_count: number;
  created_by_name?: string;
}

export interface CreateInteractionInput {
  subject: string;
  content?: string;
  type: string;
  status?: string | null;
  occurred_at: string;
  zone_ids: string[];
  tags_input?: string[];
}

interface FetchInteractionsOptions {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
  householdId?: string;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export interface FetchInteractionsResult {
  items: InteractionListItem[];
  count: number;
  next: string | null;
  previous: string | null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function normalize(payload: unknown): FetchInteractionsResult {
  if (Array.isArray(payload)) {
    const items = payload as InteractionListItem[];
    return {
      items,
      count: items.length,
      next: null,
      previous: null,
    };
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<InteractionListItem>;
    if (Array.isArray(paginated.results)) {
      return {
        items: paginated.results,
        count: typeof paginated.count === 'number' ? paginated.count : paginated.results.length,
        next: paginated.next ?? null,
        previous: paginated.previous ?? null,
      };
    }
  }

  return {
    items: [],
    count: 0,
    next: null,
    previous: null,
  };
}

export async function fetchInteractions(
  options: FetchInteractionsOptions = {}
): Promise<FetchInteractionsResult> {
  const { type, status, limit = 8, offset = 0, householdId } = options;

  const params = new URLSearchParams();
  params.set('ordering', '-occurred_at');
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (limit > 0) params.set('limit', String(limit));
  if (offset > 0) params.set('offset', String(offset));

  const response = await fetch(`/api/interactions/interactions/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(householdId ? { 'X-Household-Id': householdId } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalize(payload);
}

export async function createInteraction(
  input: CreateInteractionInput,
  householdId?: string
): Promise<InteractionListItem> {
  const csrfToken = getCookie('csrftoken');

  const response = await fetch('/api/interactions/interactions/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...(householdId ? { 'X-Household-Id': householdId } : {}),
    },
    body: JSON.stringify({
      ...input,
      tags: input.tags ?? [],
      content: input.content ?? '',
      status: input.status ?? null,
      metadata: {},
      enriched_text: '',
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errorPayload = (await response.json()) as Record<string, unknown>;
      detail = JSON.stringify(errorPayload);
    } catch {
      detail = '';
    }
    throw new Error(`API error ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return (await response.json()) as InteractionListItem;
}
