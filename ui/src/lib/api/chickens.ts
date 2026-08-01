import { api } from '@/lib/axios';

export type ChickenStatus = 'active' | 'broody' | 'sick' | 'deceased' | 'gone';

export const CHICKEN_STATUSES: ChickenStatus[] = ['active', 'broody', 'sick', 'deceased', 'gone'];
export const FLOCK_STATUSES: ChickenStatus[] = ['active', 'broody', 'sick'];

export type ChickenEventType =
  | 'arrival'
  | 'care'
  | 'illness'
  | 'broody'
  | 'molt'
  | 'predator'
  | 'death'
  | 'departure'
  | 'other';

export const CHICKEN_EVENT_TYPES: ChickenEventType[] = [
  'arrival', 'care', 'illness', 'broody', 'molt', 'predator', 'death', 'departure', 'other',
];

/** Items behind each chicken-detail tab. Null in list responses (detail only). */
export interface ChickenTabCounts {
  events: number;
  documents: number;
  photos: number;
}

export interface Chicken {
  id: string;
  household: string;
  name: string;
  breed: string;
  color: string;
  hatched_on: string | null;
  acquired_on: string | null;
  status: ChickenStatus;
  notes: string;
  zone: string | null;
  zone_name: string | null;
  tab_counts?: ChickenTabCounts | null;
  created_at: string;
  updated_at: string;
}

export interface ChickenPayload {
  name: string;
  breed?: string;
  color?: string;
  hatched_on?: string | null;
  acquired_on?: string | null;
  status?: ChickenStatus;
  notes?: string;
  zone_id?: string | null;
}

export interface EggLog {
  id: string;
  household: string;
  date: string;
  count: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface EggStatsPoint {
  date: string;
  /** null = the day was never logged (unknown, not zero) — the chart breaks the line. */
  count: number | null;
}

export type EggStatsPeriod = 7 | 30 | 90 | 365;
export const EGG_STATS_PERIODS: EggStatsPeriod[] = [7, 30, 90, 365];

export interface EggStatsCoverage {
  logged_days: number;
  total_days: number;
  rate: number;
}

export interface EggStats {
  period: EggStatsPeriod;
  today: number | null;
  avg_7d: number | null;
  avg_30d: number | null;
  month_total: number;
  total: number;
  period_total: number;
  period_avg: number | null;
  best_day: { date: string; count: number } | null;
  coverage: EggStatsCoverage;
  series: EggStatsPoint[];
}

export interface ChickenEvent {
  id: string;
  household: string;
  chicken: string | null;
  chicken_name: string | null;
  type: ChickenEventType;
  occurred_on: string;
  title: string;
  notes: string;
  created_at: string;
}

export interface ChickenEventPayload {
  chicken?: string | null;
  type: ChickenEventType;
  occurred_on: string;
  title: string;
  notes?: string;
  reminder_due_date?: string | null;
}

export interface FeedStockItemDetail {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  status: string;
  min_quantity: string | null;
}

export interface ChickenSettings {
  id: string;
  household: string;
  feed_stock_item: string | null;
  feed_stock_item_detail: FeedStockItemDetail | null;
}

export interface FlockFeedSummary {
  stock_item_id: string;
  name: string;
  quantity: string;
  unit: string;
  status: string;
  min_quantity: string | null;
}

export interface FlockSummary {
  active_count: number;
  eggs_today: number | null;
  eggs_7d: number;
  feed: FlockFeedSummary | null;
  cost: {
    total: string;
    year: string;
    feed_total: string;
    flock_total: string;
    per_egg: string | null;
    eggs_total: number;
  };
  has_data: boolean;
}

export interface ChickenPurchasePayload {
  amount?: number | null;
  supplier?: string;
  occurred_at?: string | null;
  notes?: string;
  /** Enveloppe à laquelle imputer la dépense créée. `null` = non classée. */
  budget_id?: string | null;
}

export interface ChickenPurchaseResponse extends Chicken {
  interaction_id: string;
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const paginated = payload as { results?: T[] };
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

export async function fetchChickens(filters: { status?: string; in_flock?: boolean } = {}): Promise<Chicken[]> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.in_flock) params.in_flock = 'true';
  const { data } = await api.get('/chickens/', { params });
  return normalizeList<Chicken>(data);
}

export async function fetchChicken(id: string): Promise<Chicken> {
  const { data } = await api.get(`/chickens/${id}/`);
  return data as Chicken;
}

export async function createChicken(payload: ChickenPayload): Promise<Chicken> {
  const { data } = await api.post('/chickens/', payload);
  return data as Chicken;
}

export async function updateChicken(id: string, payload: Partial<ChickenPayload>): Promise<Chicken> {
  const { data } = await api.patch(`/chickens/${id}/`, payload);
  return data as Chicken;
}

export async function deleteChicken(id: string): Promise<void> {
  await api.delete(`/chickens/${id}/`);
}

export async function purchaseChicken(
  id: string,
  payload: ChickenPurchasePayload,
): Promise<ChickenPurchaseResponse> {
  const { data } = await api.post(`/chickens/${id}/purchase/`, {
    amount: payload.amount ?? null,
    supplier: payload.supplier ?? '',
    occurred_at: payload.occurred_at ?? null,
    notes: payload.notes ?? '',
  });
  return data as ChickenPurchaseResponse;
}

export async function fetchEggLogs(filters: { date_from?: string; date_to?: string } = {}): Promise<EggLog[]> {
  const params: Record<string, string> = {};
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  const { data } = await api.get('/chickens/egg-logs/', { params });
  return normalizeList<EggLog>(data);
}

/** Upsert of the daily count — the API replaces the row for the same day. */
export async function logEggs(payload: { date: string; count: number; note?: string }): Promise<EggLog> {
  const { data } = await api.post('/chickens/egg-logs/', {
    date: payload.date,
    count: payload.count,
    note: payload.note ?? '',
  });
  return data as EggLog;
}

export async function deleteEggLog(id: string): Promise<void> {
  await api.delete(`/chickens/egg-logs/${id}/`);
}

export async function fetchEggStats(period: EggStatsPeriod = 30): Promise<EggStats> {
  const { data } = await api.get('/chickens/egg-logs/stats/', { params: { period } });
  return data as EggStats;
}

export async function fetchChickenEvents(filters: { chicken?: string } = {}): Promise<ChickenEvent[]> {
  const params: Record<string, string> = {};
  if (filters.chicken) params.chicken = filters.chicken;
  const { data } = await api.get('/chickens/events/', { params });
  return normalizeList<ChickenEvent>(data);
}

export async function createChickenEvent(payload: ChickenEventPayload): Promise<ChickenEvent> {
  const { data } = await api.post('/chickens/events/', payload);
  return data as ChickenEvent;
}

export async function updateChickenEvent(
  id: string,
  payload: Partial<ChickenEventPayload>,
): Promise<ChickenEvent> {
  const { data } = await api.patch(`/chickens/events/${id}/`, payload);
  return data as ChickenEvent;
}

export async function deleteChickenEvent(id: string): Promise<void> {
  await api.delete(`/chickens/events/${id}/`);
}

export async function fetchChickenSettings(): Promise<ChickenSettings> {
  const { data } = await api.get('/chickens/settings/');
  return data as ChickenSettings;
}

export async function updateChickenSettings(payload: { feed_stock_item: string | null }): Promise<ChickenSettings> {
  const { data } = await api.put('/chickens/settings/', payload);
  return data as ChickenSettings;
}

export async function fetchFlockSummary(): Promise<FlockSummary> {
  const { data } = await api.get('/chickens/summary/');
  return data as FlockSummary;
}

// --- Recurring chores --------------------------------------------------------

/**
 * Derived state of a chore, computed server-side by `chickens.services.chore_status`.
 *
 * Never recompute `is_due` from `next_due_on` in the client: the reminder, the
 * dashboard alert and this badge must all read the one verdict the server gives,
 * or the panel and the notification end up disagreeing about what is late.
 */
export interface ChoreStatus {
  /** null = never done; the cadence is then counted from `starts_on`. */
  last_done_on: string | null;
  next_due_on: string;
  days_overdue: number;
  is_due: boolean;
  never_done: boolean;
}

export interface ChickenChore {
  id: string;
  household: string;
  name: string;
  emoji: string;
  interval_days: number;
  starts_on: string;
  is_active: boolean;
  notes: string;
  status: ChoreStatus;
  created_at: string;
  updated_at: string;
}

export interface ChickenChorePayload {
  name: string;
  interval_days: number;
  emoji?: string;
  starts_on?: string;
  notes?: string;
  is_active?: boolean;
}

export async function fetchChores(
  filters: { active?: boolean } = {},
): Promise<ChickenChore[]> {
  const params: Record<string, string> = {};
  if (filters.active === false) params.active = 'false';
  const { data } = await api.get('/chickens/chores/', { params });
  return (data.results ?? data) as ChickenChore[];
}

export async function createChore(payload: ChickenChorePayload): Promise<ChickenChore> {
  const { data } = await api.post('/chickens/chores/', payload);
  return data as ChickenChore;
}

export async function updateChore(
  id: string,
  payload: Partial<ChickenChorePayload>,
): Promise<ChickenChore> {
  const { data } = await api.patch(`/chickens/chores/${id}/`, payload);
  return data as ChickenChore;
}

export async function deleteChore(id: string): Promise<void> {
  await api.delete(`/chickens/chores/${id}/`);
}

export async function completeChore(
  id: string,
  payload: { occurred_on?: string; notes?: string } = {},
): Promise<{ chore: ChickenChore; event: ChickenEvent }> {
  const { data } = await api.post(`/chickens/chores/${id}/complete/`, payload);
  return data as { chore: ChickenChore; event: ChickenEvent };
}
