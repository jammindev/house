import { api } from '@/lib/axios';
import type { Granularity } from '@/lib/period';

// ── Types ─────────────────────────────────────────────────────────────────────

// Water granularities — readings are date-only, so no hourly view.
export type WaterGranularity = Exclude<Granularity, 'hour'>;

export interface WaterReading {
  id: string;
  household: string;
  reading_date: string;
  index_m3: string;
  created_at: string;
  updated_at: string;
}

export interface WaterReadingPayload {
  reading_date: string;
  index_m3: string;
}

export interface WaterConsumptionBucket {
  ts: string;
  total_l: number;
}

export interface WaterConsumptionSummary {
  granularity: WaterGranularity;
  date_from: string;
  date_to: string;
  total_l: number;
  buckets: WaterConsumptionBucket[];
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: T[] }).results)) {
    return (payload as { results: T[] }).results;
  }
  return [];
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchWaterReadings(): Promise<WaterReading[]> {
  const { data } = await api.get('/water/readings/');
  return normalizeList<WaterReading>(data);
}

export async function createWaterReading(payload: WaterReadingPayload): Promise<WaterReading> {
  const { data } = await api.post('/water/readings/', payload);
  return data as WaterReading;
}

export async function updateWaterReading(id: string, payload: Partial<WaterReadingPayload>): Promise<WaterReading> {
  const { data } = await api.patch(`/water/readings/${id}/`, payload);
  return data as WaterReading;
}

export async function deleteWaterReading(id: string): Promise<void> {
  await api.delete(`/water/readings/${id}/`);
}

export async function fetchWaterConsumptionSummary(params: {
  granularity: WaterGranularity;
  date_from: string;
  date_to: string;
}): Promise<WaterConsumptionSummary> {
  const { data } = await api.get('/water/consumption/summary/', { params });
  return data as WaterConsumptionSummary;
}
