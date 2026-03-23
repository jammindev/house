import { api } from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SupplyType = 'single_phase' | 'three_phase';
export type DeviceType = 'breaker' | 'rcd' | 'combined' | 'main';
export type DeviceRole = 'main' | 'divisionary' | 'spare';
export type PhaseType = 'L1' | 'L2' | 'L3';
export type CurveType = 'b' | 'c' | 'd' | 'other';
export type RcdTypeCode = 'ac' | 'a' | 'f' | 'b' | 'other';
export type UsagePointKind = 'socket' | 'light';
export type NfCompliance = 'yes' | 'no' | 'partial';

export interface ElectricityBoard {
  id: string;
  household: string;
  label?: string | null;
  parent?: string | null;
  zone: string;
  name: string;
  supply_type: SupplyType;
  location?: string;
  rows?: number | null;
  slots_per_row?: number | null;
  last_inspection_date?: string | null;
  nf_c_15100_compliant?: NfCompliance | null;
  main_notes?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardPayload {
  name: string;
  zone: string;
  supply_type: SupplyType;
  label?: string;
  parent?: string | null;
  location?: string;
  rows?: number | null;
  slots_per_row?: number | null;
  last_inspection_date?: string | null;
  nf_c_15100_compliant?: NfCompliance | null;
  main_notes?: string;
}

export interface ProtectiveDevice {
  id: string;
  household: string;
  board: string;
  parent_rcd?: string | null;
  label?: string | null;
  device_type: DeviceType;
  role?: DeviceRole | null;
  row?: number | null;
  position?: number | null;
  position_end?: number | null;
  phase?: PhaseType | null;
  rating_amps?: number | null;
  pole_count?: 1 | 2 | 3 | 4 | null;
  curve_type?: CurveType | '';
  sensitivity_ma?: number | null;
  type_code?: RcdTypeCode | '';
  phase_coverage?: string[] | null;
  brand?: string;
  model_ref?: string;
  installed_at?: string | null;
  is_spare?: boolean;
  is_active?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DevicePayload {
  board: string;
  device_type: DeviceType;
  label?: string;
  role?: DeviceRole | null;
  rating_amps?: number | null;
  curve_type?: CurveType | '';
  sensitivity_ma?: number | null;
  type_code?: RcdTypeCode | '';
  phase?: PhaseType | null;
  row?: number | null;
  position?: number | null;
  position_end?: number | null;
  pole_count?: 1 | 2 | 3 | 4 | null;
  parent_rcd?: string | null;
  brand?: string;
  model_ref?: string;
  installed_at?: string | null;
  is_spare?: boolean;
  notes?: string;
}

export interface ElectricCircuit {
  id: string;
  household: string;
  board: string;
  protective_device: string;
  label: string;
  name: string;
  is_active?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CircuitPayload {
  board: string;
  protective_device: string;
  label: string;
  name: string;
  is_active?: boolean;
  notes?: string;
}

export interface UsagePoint {
  id: string;
  household: string;
  label: string;
  name: string;
  kind: UsagePointKind;
  zone?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UsagePointPayload {
  label: string;
  name: string;
  kind: UsagePointKind;
  zone?: string | null;
  notes?: string;
}

export interface CircuitUsagePointLink {
  id: string;
  household: string;
  circuit: string;
  usage_point: string;
  is_active?: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
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

// ── Boards ────────────────────────────────────────────────────────────────────

export async function fetchBoards(): Promise<ElectricityBoard[]> {
  const { data } = await api.get('/electricity/boards/');
  return normalizeList<ElectricityBoard>(data);
}

export async function createBoard(payload: BoardPayload): Promise<ElectricityBoard> {
  const { data } = await api.post('/electricity/boards/', payload);
  return data as ElectricityBoard;
}

export async function updateBoard(id: string, payload: Partial<BoardPayload>): Promise<ElectricityBoard> {
  const { data } = await api.patch(`/electricity/boards/${id}/`, payload);
  return data as ElectricityBoard;
}

export async function deleteBoard(id: string): Promise<void> {
  await api.delete(`/electricity/boards/${id}/`);
}

// ── Protective Devices ────────────────────────────────────────────────────────

export async function fetchDevices(boardId?: string): Promise<ProtectiveDevice[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/protective-devices/', { params });
  return normalizeList<ProtectiveDevice>(data);
}

export async function createDevice(payload: DevicePayload): Promise<ProtectiveDevice> {
  const { data } = await api.post('/electricity/protective-devices/', payload);
  return data as ProtectiveDevice;
}

export async function updateDevice(id: string, payload: Partial<DevicePayload>): Promise<ProtectiveDevice> {
  const { data } = await api.patch(`/electricity/protective-devices/${id}/`, payload);
  return data as ProtectiveDevice;
}

export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/electricity/protective-devices/${id}/`);
}

// ── Circuits ──────────────────────────────────────────────────────────────────

export async function fetchCircuits(boardId?: string): Promise<ElectricCircuit[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/circuits/', { params });
  return normalizeList<ElectricCircuit>(data);
}

export async function createCircuit(payload: CircuitPayload): Promise<ElectricCircuit> {
  const { data } = await api.post('/electricity/circuits/', payload);
  return data as ElectricCircuit;
}

export async function updateCircuit(id: string, payload: Partial<CircuitPayload>): Promise<ElectricCircuit> {
  const { data } = await api.patch(`/electricity/circuits/${id}/`, payload);
  return data as ElectricCircuit;
}

export async function deleteCircuit(id: string): Promise<void> {
  await api.delete(`/electricity/circuits/${id}/`);
}

// ── Usage Points ──────────────────────────────────────────────────────────────

export async function fetchUsagePoints(): Promise<UsagePoint[]> {
  const { data } = await api.get('/electricity/usage-points/');
  return normalizeList<UsagePoint>(data);
}

export async function createUsagePoint(payload: UsagePointPayload): Promise<UsagePoint> {
  const { data } = await api.post('/electricity/usage-points/', payload);
  return data as UsagePoint;
}

export async function bulkCreateUsagePoints(
  payload: UsagePointPayload & { quantity: number },
): Promise<UsagePoint[]> {
  const { data } = await api.post('/electricity/usage-points/bulk-create/', payload);
  return data as UsagePoint[];
}

export async function updateUsagePoint(id: string, payload: Partial<UsagePointPayload>): Promise<UsagePoint> {
  const { data } = await api.patch(`/electricity/usage-points/${id}/`, payload);
  return data as UsagePoint;
}

export async function deleteUsagePoint(id: string): Promise<void> {
  await api.delete(`/electricity/usage-points/${id}/`);
}

// ── Links ─────────────────────────────────────────────────────────────────────

export async function fetchLinks(boardId?: string): Promise<CircuitUsagePointLink[]> {
  const params = boardId ? { board: boardId } : {};
  const { data } = await api.get('/electricity/links/', { params });
  return normalizeList<CircuitUsagePointLink>(data);
}

export async function createLink(circuitId: string, usagePointId: string): Promise<CircuitUsagePointLink> {
  const { data } = await api.post('/electricity/links/', {
    circuit: circuitId,
    usage_point: usagePointId,
    is_active: true,
  });
  return data as CircuitUsagePointLink;
}

export async function deactivateLink(id: string): Promise<void> {
  await api.post(`/electricity/links/${id}/deactivate/`, {});
}

