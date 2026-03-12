export type TagType = 'interaction' | 'document' | 'contact' | 'structure';

export interface TagOption {
  id: string;
  name: string;
  type: TagType;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

interface FetchTagsOptions {
  type?: TagType;
  search?: string;
}

function normalizeList(payload: unknown): TagOption[] {
  if (Array.isArray(payload)) {
    return payload as TagOption[];
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<TagOption>;
    if (Array.isArray(paginated.results)) {
      return paginated.results;
    }
  }

  return [];
}

export async function fetchTags(options: FetchTagsOptions = {}): Promise<TagOption[]> {
  const { type, search } = options;
  const params = new URLSearchParams();

  if (type) {
    params.set('type', type);
  }

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(`/api/tags/tags/${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeList(payload);
}