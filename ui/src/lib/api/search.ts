import { api } from '@/lib/axios';

/**
 * One search result. Same shape as the agent's context picker
 * (`AgentSearchResult`) because it is the same endpoint family — see
 * `apps/agent/search_api.py`.
 */
export interface SearchResult {
  /** Agent `entity_type` — drives the icon and the group heading. */
  entity_type: string;
  object_id: string;
  label: string;
  /** In-app path to the entity, built server-side from its `SearchableSpec`. */
  url: string;
  /** Excerpt with `<<…>>` around the matched terms — see `highlight.ts`. */
  snippet: string;
}

/** Below this the server returns nothing: one letter ranks nothing. */
export const MIN_QUERY_LENGTH = 2;

/** Search everything the household owns. Empty/short queries resolve to `[]`. */
export async function searchHousehold(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  const { data } = await api.get<{ results: SearchResult[] }>('/search/', {
    params: { q: trimmed },
  });
  return data?.results ?? [];
}
