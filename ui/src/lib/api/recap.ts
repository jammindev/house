import { api } from '@/lib/axios';

// --- Household monthly recap (parcours 27) ----------------------------------

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : (data?.results ?? []);
}

/**
 * One story card. `value_type` says how to display `value`:
 * - `money` → raw decimal string, format it with `formatAmount` (one formatter rule);
 * - `count` / `raw` → already a display string, show as-is.
 *
 * `headline` and `caption` arrive localized from the server, which renders them
 * from the frozen snapshot in the reader's language.
 */
export interface RecapCard {
  kind: string;
  emoji: string;
  headline: string;
  value: string;
  value_type: 'money' | 'count' | 'raw';
  caption: string;
}

export interface RecapChapter {
  key: string;
  emoji: string;
  title: string;
  cards: RecapCard[];
}

export interface HouseholdRecap {
  id: string;
  month: string; // 'YYYY-MM'
  card_count: number;
  chapters: RecapChapter[];
  created_at: string;
}

export async function fetchRecaps(): Promise<HouseholdRecap[]> {
  const { data } = await api.get<HouseholdRecap[] | { results: HouseholdRecap[] }>('/recap/');
  return unwrapList(data);
}

/**
 * The last closed month, generated on first read.
 *
 * A `204` means the month had too little to tell — a legitimate answer, not an
 * error, so it surfaces as `null` rather than throwing.
 */
export async function fetchLatestRecap(): Promise<HouseholdRecap | null> {
  const { data, status } = await api.get<HouseholdRecap | null>('/recap/latest/');
  if (status === 204 || !data) return null;
  return data;
}

export async function fetchRecap(month: string): Promise<HouseholdRecap> {
  const { data } = await api.get<HouseholdRecap>(`/recap/${month}/`);
  return data;
}

/** Chapter keys this household can be told — gated by its enabled modules. */
export async function fetchRecapChapters(): Promise<string[]> {
  const { data } = await api.get<string[]>('/recap/chapters/');
  return data ?? [];
}
