import { api } from '@/lib/axios';

export interface TrackerSparklinePoint {
  value: string;
  occurred_at: string;
}

export interface Tracker {
  id: string;
  name: string;
  description: string;
  unit: string;
  emoji: string;
  is_active: boolean;
  project: string | null;
  project_title: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  target_url: string | null;
  last_value: string | null;
  last_entry_at: string | null;
  sparkline: TrackerSparklinePoint[];
  created_at: string;
  created_by: number | null;
}

export interface TrackerEntry {
  id: string;
  tracker: string;
  value: string;
  occurred_at: string;
  note: string;
  created_at: string;
  created_by: number | null;
}

export interface TrackerPayload {
  name: string;
  unit?: string;
  description?: string;
  emoji?: string;
  project?: string | null;
  target_type?: string | null;
  target_id?: string | null;
}

export interface TrackerEntryPayload {
  tracker: string;
  value: string;
  occurred_at?: string;
  note?: string;
}

/** Render an API decimal without trailing zeros (148.200 → "148.2"). */
export function formatTrackerValue(value: string | null): string {
  if (value == null) return '';
  if (!value.includes('.')) return value;
  return value.replace(/0+$/, '').replace(/\.$/, '');
}

function unwrap<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function fetchTrackers(
  options: { projectId?: string } = {},
): Promise<Tracker[]> {
  const params: Record<string, string> = { limit: '200' };
  if (options.projectId) params.project = options.projectId;
  const res = await api.get('/trackers/trackers/', { params });
  return unwrap<Tracker>(res.data);
}

export async function fetchTracker(id: string): Promise<Tracker> {
  const res = await api.get(`/trackers/trackers/${id}/`);
  return res.data;
}

export async function createTracker(payload: TrackerPayload): Promise<Tracker> {
  const res = await api.post('/trackers/trackers/', payload);
  return res.data;
}

export async function updateTracker(
  id: string,
  payload: Partial<TrackerPayload>,
): Promise<Tracker> {
  const res = await api.patch(`/trackers/trackers/${id}/`, payload);
  return res.data;
}

/** DELETE archives the tracker (is_active=false) — history is kept server-side. */
export async function archiveTracker(id: string): Promise<void> {
  await api.delete(`/trackers/trackers/${id}/`);
}

export async function fetchTrackerEntries(trackerId: string): Promise<TrackerEntry[]> {
  const res = await api.get('/trackers/entries/', {
    params: { tracker: trackerId, limit: '100' },
  });
  return unwrap<TrackerEntry>(res.data);
}

export async function createTrackerEntry(
  payload: TrackerEntryPayload,
): Promise<TrackerEntry> {
  const res = await api.post('/trackers/entries/', payload);
  return res.data;
}

export async function updateTrackerEntry(
  id: string,
  payload: Partial<Omit<TrackerEntryPayload, 'tracker'>>,
): Promise<TrackerEntry> {
  const res = await api.patch(`/trackers/entries/${id}/`, payload);
  return res.data;
}

export async function deleteTrackerEntry(id: string): Promise<void> {
  await api.delete(`/trackers/entries/${id}/`);
}
