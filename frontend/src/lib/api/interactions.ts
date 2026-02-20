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

interface FetchInteractionsOptions {
  type?: string;
  status?: string;
  limit?: number;
  householdId?: string;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

function normalizeList(payload: unknown): InteractionListItem[] {
  if (Array.isArray(payload)) {
    return payload as InteractionListItem[];
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<InteractionListItem>;
    if (Array.isArray(paginated.results)) {
      return paginated.results;
    }
  }

  return [];
}

export async function fetchInteractions(
  options: FetchInteractionsOptions = {}
): Promise<InteractionListItem[]> {
  const { type, status, limit = 8, householdId } = options;

  const params = new URLSearchParams();
  params.set('ordering', '-occurred_at');
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (limit > 0) params.set('limit', String(limit));

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
  return normalizeList(payload);
}
