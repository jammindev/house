import { api } from '@/lib/axios';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  color: string;
  parent?: string | null;
  /** Normalised from API `parent` field — used in new code */
  parentId?: string | null;
  full_path?: string;
  depth?: number;
  children_count?: number;
  note?: string | null;
  surface?: number | null;
  updated_at?: string;
  created_at?: string | null;
  household?: string;
}

export interface ZoneDetail extends Zone {
  parent_info?: { id: string; name: string; color?: string | null } | null;
}

export interface ZonePayload {
  name: string;
  parent: string | null;
  color: string;
  note?: string | null;
  surface?: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retourne la zone racine du household (parent === null).
 * Garantie d'exister par la DB constraint (1 racine par household).
 */
export function findRootZone(zones: Zone[]): Zone | undefined {
  return zones.find((z) => !z.parentId && !z.parent);
}

function normalizeZone(raw: Zone & { parent?: string | null }): Zone {
  return {
    ...raw,
    parentId: raw.parentId ?? raw.parent ?? null,
  };
}

function normalizeList(payload: unknown): Zone[] {
  if (Array.isArray(payload)) return (payload as Zone[]).map(normalizeZone);
  const p = payload as { results?: Zone[] };
  return Array.isArray(p.results) ? p.results.map(normalizeZone) : [];
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchZones(): Promise<Zone[]> {
  const { data } = await api.get('/zones/');
  return normalizeList(data);
}

export async function fetchZone(id: string): Promise<ZoneDetail> {
  const { data } = await api.get(`/zones/${id}/`);
  return normalizeZone(data as Zone) as ZoneDetail;
}

export async function createZone(payload: ZonePayload): Promise<Zone> {
  const { data } = await api.post('/zones/', payload);
  return normalizeZone(data as Zone);
}

export async function updateZone(id: string, payload: Partial<ZonePayload>): Promise<Zone> {
  const { data } = await api.patch(`/zones/${id}/`, payload);
  return normalizeZone(data as Zone);
}

export async function deleteZone(id: string): Promise<void> {
  await api.delete(`/zones/${id}/`);
}

// Keep legacy alias for compatibility with equipment and other consumers
export type ZoneOption = Zone;
