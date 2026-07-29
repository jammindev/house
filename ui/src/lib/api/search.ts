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

async function get(query: string, semantic: boolean): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  const { data } = await api.get<{ results: SearchResult[] }>('/search/', {
    params: semantic ? { q: trimmed, semantic: 1 } : { q: trimmed },
  });
  return data?.results ?? [];
}

/**
 * Stage one — keyword search over everything the household owns. A few indexed SQL
 * queries, back in milliseconds, so it can run on every debounced keystroke.
 */
export function searchHousehold(query: string): Promise<SearchResult[]> {
  return get(query, false);
}

/**
 * Stage two — what only the *meaning* finds (« chauffage » → « pompe à chaleur »),
 * minus everything stage one already returned.
 *
 * Separate call because embedding the query costs ~200 ms (up to 1.6 s observed in
 * production): waiting for it would make the whole box feel that slow. Resolves to
 * `[]` when the deployment has no semantic index — a normal answer, not an error.
 */
export function searchHouseholdBySense(query: string): Promise<SearchResult[]> {
  return get(query, true);
}
