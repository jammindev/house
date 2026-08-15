import { api } from '@/lib/axios';

export type TreeKind = 'fruit_tree' | 'berry_bush' | 'vine' | 'ornamental';
export type TreeStatus = 'alive' | 'ailing' | 'dead' | 'removed';

export const TREE_KINDS: TreeKind[] = ['fruit_tree', 'berry_bush', 'vine', 'ornamental'];
export const TREE_STATUSES: TreeStatus[] = ['alive', 'ailing', 'dead', 'removed'];
/** Statuses the default listing shows — dead and removed keep their history. */
export const LIVING_STATUSES: TreeStatus[] = ['alive', 'ailing'];

/** Kinds that never yield a harvest — the sheet hides the tab rather than offer a lie. */
export const NON_HARVESTING_KINDS: TreeKind[] = ['ornamental'];

export type TreeEventType =
  | 'pruning'
  | 'treatment'
  | 'fertilizing'
  | 'watering'
  | 'training'
  | 'observation'
  | 'flowering'
  | 'other';

export const TREE_EVENT_TYPES: TreeEventType[] = [
  'pruning', 'treatment', 'fertilizing', 'watering',
  'training', 'observation', 'flowering', 'other',
];

export type HarvestUnit = 'kg' | 'piece' | 'litre';
export const HARVEST_UNITS: HarvestUnit[] = ['kg', 'piece', 'litre'];

/** Items behind each subject-detail tab. Null in list responses (detail only). */
export interface TreeTabCounts {
  events: number;
  harvests: number;
  documents: number;
}

export interface Tree {
  id: string;
  household: string;
  name: string;
  kind: TreeKind;
  species: string;
  rootstock: string;
  planted_on: string | null;
  /** Both bounds or neither — null means **nobody filled it in**, not "never flowers". */
  flowering_start_month: number | null;
  flowering_end_month: number | null;
  status: TreeStatus;
  notes: string;
  zone: string;
  zone_name: string | null;
  /** Derived from planted_on, never stored. Null when the planting date is unknown. */
  age_years: number | null;
  tab_counts?: TreeTabCounts | null;
  created_at: string;
  updated_at: string;
}

export interface TreePayload {
  name: string;
  zone_id?: string;
  kind?: TreeKind;
  species?: string;
  rootstock?: string;
  planted_on?: string | null;
  flowering_start_month?: number | null;
  flowering_end_month?: number | null;
  status?: TreeStatus;
  notes?: string;
}

export interface TreeEvent {
  id: string;
  household: string;
  tree: string;
  tree_name: string | null;
  type: TreeEventType;
  occurred_on: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TreeEventPayload {
  tree: string;
  type: TreeEventType;
  title: string;
  occurred_on?: string;
  notes?: string;
}

export interface Harvest {
  id: string;
  household: string;
  tree: string;
  tree_name: string | null;
  harvested_on: string;
  quantity: string;
  unit: HarvestUnit;
  notes: string;
  season: number;
  created_at: string;
  updated_at: string;
}

export interface HarvestPayload {
  tree: string;
  quantity: string;
  unit?: HarvestUnit;
  harvested_on?: string;
  notes?: string;
}

/** A total is always **per unit** — 12 kg and 40 pieces never add up. */
export interface HarvestTotal {
  unit: HarvestUnit;
  quantity: string;
}

export interface HarvestSeason {
  season: number;
  totals: HarvestTotal[];
}

export interface HarvestSeries {
  current_season: number;
  seasons: HarvestSeason[];
}

// --- subjects ---------------------------------------------------------------

export async function fetchTrees(
  filters: { zone?: string; kind?: string; status?: string } = {},
): Promise<Tree[]> {
  const { data } = await api.get('/orchard/trees/', { params: filters });
  return data;
}

export async function fetchTree(id: string): Promise<Tree> {
  const { data } = await api.get(`/orchard/trees/${id}/`);
  return data;
}

export async function createTree(payload: TreePayload): Promise<Tree> {
  const { data } = await api.post('/orchard/trees/', payload);
  return data;
}

export async function updateTree(id: string, payload: Partial<TreePayload>): Promise<Tree> {
  const { data } = await api.patch(`/orchard/trees/${id}/`, payload);
  return data;
}

export async function deleteTree(id: string): Promise<void> {
  await api.delete(`/orchard/trees/${id}/`);
}

// --- journal ----------------------------------------------------------------

export async function fetchTreeEvents(
  filters: { tree?: string; type?: string } = {},
): Promise<TreeEvent[]> {
  const { data } = await api.get('/orchard/events/', { params: filters });
  return data;
}

export async function createTreeEvent(payload: TreeEventPayload): Promise<TreeEvent> {
  const { data } = await api.post('/orchard/events/', payload);
  return data;
}

export async function updateTreeEvent(
  id: string,
  payload: Partial<TreeEventPayload>,
): Promise<TreeEvent> {
  const { data } = await api.patch(`/orchard/events/${id}/`, payload);
  return data;
}

export async function deleteTreeEvent(id: string): Promise<void> {
  await api.delete(`/orchard/events/${id}/`);
}

// --- harvests ---------------------------------------------------------------

export async function fetchHarvests(
  filters: { tree?: string; season?: number } = {},
): Promise<Harvest[]> {
  const { data } = await api.get('/orchard/harvests/', { params: filters });
  return data;
}

export async function createHarvest(payload: HarvestPayload): Promise<Harvest> {
  const { data } = await api.post('/orchard/harvests/', payload);
  return data;
}

export async function updateHarvest(
  id: string,
  payload: Partial<HarvestPayload>,
): Promise<Harvest> {
  const { data } = await api.patch(`/orchard/harvests/${id}/`, payload);
  return data;
}

export async function deleteHarvest(id: string): Promise<void> {
  await api.delete(`/orchard/harvests/${id}/`);
}

export async function fetchHarvestSeries(
  filters: { tree?: string; seasons?: number } = {},
): Promise<HarvestSeries> {
  const { data } = await api.get('/orchard/harvests/summary/', { params: filters });
  return data;
}

// --- seasonal care rules ------------------------------------------------------

export type CareRuleState = 'upcoming' | 'due' | 'done' | 'missed';

/** State of one (rule, subject) pair — always derived server-side, never stored. */
export interface CareRuleTarget {
  tree: string;
  tree_name: string;
  state: CareRuleState;
  season: number;
  window_start: string;
  window_end: string;
  next_window_start: string;
  last_done_on: string | null;
}

export interface CareRule {
  id: string;
  household: string;
  name: string;
  emoji: string;
  start_month: number;
  end_month: number;
  event_type: TreeEventType;
  /** Scope: one subject… */
  tree: string | null;
  tree_name: string | null;
  /** …or every living subject of a kind. Never both. */
  kind: TreeKind | '';
  is_active: boolean;
  notes: string;
  targets: CareRuleTarget[];
  created_at: string;
  updated_at: string;
}

export interface CareRulePayload {
  name: string;
  start_month: number;
  end_month: number;
  event_type?: TreeEventType;
  tree?: string | null;
  kind?: TreeKind | '';
  emoji?: string;
  notes?: string;
  is_active?: boolean;
}

/** One line of « ce que la saison réclame ». */
export interface SeasonRow {
  rule: string;
  rule_name: string;
  emoji: string;
  tree: string;
  tree_name: string;
  state: 'due' | 'missed';
  season: number;
  window_start: string;
  window_end: string;
  last_done_on: string | null;
}

export interface SeasonPanel {
  rows: SeasonRow[];
  total: number;
}

export async function fetchCareRules(): Promise<CareRule[]> {
  const { data } = await api.get('/orchard/care-rules/');
  return data;
}

export async function createCareRule(payload: CareRulePayload): Promise<CareRule> {
  const { data } = await api.post('/orchard/care-rules/', payload);
  return data;
}

export async function updateCareRule(
  id: string,
  payload: Partial<CareRulePayload>,
): Promise<CareRule> {
  const { data } = await api.patch(`/orchard/care-rules/${id}/`, payload);
  return data;
}

export async function deleteCareRule(id: string): Promise<void> {
  await api.delete(`/orchard/care-rules/${id}/`);
}

export async function completeCareRule(
  id: string,
  payload: { tree: string; occurred_on?: string; notes?: string },
): Promise<TreeEvent> {
  const { data } = await api.post(`/orchard/care-rules/${id}/complete/`, payload);
  return data;
}

export async function fetchSeasonPanel(): Promise<SeasonPanel> {
  const { data } = await api.get('/orchard/care-rules/season/');
  return data;
}

export async function createCareTask(
  id: string,
  payload: { tree: string },
): Promise<{ id: string; subject: string }> {
  const { data } = await api.post(`/orchard/care-rules/${id}/create-task/`, payload);
  return data;
}

export interface TreePurchasePayload {
  amount: string;
  supplier?: string;
  occurred_at?: string;
  notes?: string;
  budget_id?: string | null;
}

export async function purchaseTree(id: string, payload: TreePurchasePayload): Promise<Tree> {
  const { data } = await api.post(`/orchard/trees/${id}/purchase/`, payload);
  return data;
}
