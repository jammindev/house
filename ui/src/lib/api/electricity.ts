import { api } from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ElectricityBoard {
  id: string;
  name: string;
  supply_type: string;
}

export interface ElectricityBreaker {
  id: string;
  label: string;
  rating_amps?: number;
  curve_type?: string;
}

export interface ElectricityCircuit {
  id: string;
  label: string;
  name?: string;
  phase?: string | null;
}

export interface ElectricityUsagePoint {
  id: string;
  label: string;
  name?: string;
  kind?: string;
}

export interface ElectricityLink {
  id: string;
  is_active: boolean;
  circuit: string;
  usage_point: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const p = payload as { results?: T[] };
    if (Array.isArray(p.results)) return p.results;
  }
  return [];
}

// ── Fetch functions (no React, no hooks) ──────────────────────────────────────

export async function fetchBoards(): Promise<ElectricityBoard[]> {
  const { data } = await api.get('/electricity/boards/');
  return normalizeList<ElectricityBoard>(data);
}

export async function fetchBreakers(boardId?: string): Promise<ElectricityBreaker[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/breakers/', { params });
  return normalizeList<ElectricityBreaker>(data);
}

export async function fetchCircuits(boardId?: string): Promise<ElectricityCircuit[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/circuits/', { params });
  return normalizeList<ElectricityCircuit>(data);
}

export async function fetchUsagePoints(boardId?: string): Promise<ElectricityUsagePoint[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/usage-points/', { params });
  return normalizeList<ElectricityUsagePoint>(data);
}

export async function fetchLinks(boardId?: string): Promise<ElectricityLink[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/links/', { params });
  return normalizeList<ElectricityLink>(data);
}
