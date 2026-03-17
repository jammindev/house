import { api } from '@/lib/axios';

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
  const params: Record<string, string> = {};

  if (type) params.type = type;
  if (search) params.search = search;

  const { data } = await api.get('/tags/tags/', { params });
  return normalizeList(data);
}
