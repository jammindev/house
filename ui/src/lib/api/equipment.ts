import { api } from '@/lib/axios';
import type { ZoneOption } from './zones';

type EquipmentStatus = 'active' | 'maintenance' | 'storage' | 'retired' | 'lost' | 'ordered';

export interface EquipmentListItem {
  id: string;
  household: string;
  zone: string | null;
  zone_name?: string | null;
  name: string;
  category: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: string | number | null;
  purchase_vendor?: string | null;
  warranty_expires_on?: string | null;
  warranty_provider?: string | null;
  warranty_notes?: string;
  maintenance_interval_months?: number | null;
  last_service_at?: string | null;
  next_service_due?: string | null;
  status: EquipmentStatus;
  condition?: string | null;
  installed_at?: string | null;
  retired_at?: string | null;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface EquipmentAuditUser {
  id: string;
  email: string;
  full_name: string;
}

export interface EquipmentAudit {
  created_by: EquipmentAuditUser | null;
  updated_by: EquipmentAuditUser | null;
}

export interface EquipmentInteractionItem {
  equipment: string;
  interaction: string;
  interaction_subject?: string;
  interaction_type?: string;
  interaction_status?: string | null;
  interaction_occurred_at?: string;
  role?: string;
  note?: string;
  created_at: string;
}

export interface EquipmentPayload {
  zone?: string | null;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  purchase_vendor?: string;
  warranty_expires_on?: string | null;
  warranty_provider?: string;
  warranty_notes?: string;
  maintenance_interval_months?: number | null;
  last_service_at?: string | null;
  status: EquipmentStatus;
  condition?: string;
  installed_at?: string | null;
  retired_at?: string | null;
  notes?: string;
  tags?: string[];
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

interface FetchEquipmentOptions {
  search?: string;
  status?: string;
  zone?: string;
  ordering?: string;
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) {
      return paginated.results;
    }
  }

  return [];
}

export async function fetchEquipmentList(options: FetchEquipmentOptions = {}): Promise<EquipmentListItem[]> {
  const params: Record<string, string> = { ordering: options.ordering ?? 'name' };
  if (options.search) params.search = options.search;
  if (options.status) params.status = options.status;
  if (options.zone) params.zone = options.zone;

  const { data } = await api.get('/equipment/', { params });
  return normalizeList<EquipmentListItem>(data);
}

export async function fetchEquipment(id: string): Promise<EquipmentListItem> {
  const { data } = await api.get(`/equipment/${id}/`);
  return data as EquipmentListItem;
}

export async function createEquipment(input: EquipmentPayload): Promise<EquipmentListItem> {
  const { data } = await api.post('/equipment/', {
    ...input,
    tags: input.tags ?? [],
    warranty_notes: input.warranty_notes ?? '',
    notes: input.notes ?? '',
    zone: input.zone || null,
    purchase_date: input.purchase_date || null,
    warranty_expires_on: input.warranty_expires_on || null,
    last_service_at: input.last_service_at || null,
    installed_at: input.installed_at || null,
    retired_at: input.retired_at || null,
  });
  return data as EquipmentListItem;
}

export async function updateEquipment(id: string, input: EquipmentPayload): Promise<EquipmentListItem> {
  const { data } = await api.patch(`/equipment/${id}/`, {
    ...input,
    tags: input.tags ?? [],
    warranty_notes: input.warranty_notes ?? '',
    notes: input.notes ?? '',
    zone: input.zone || null,
    purchase_date: input.purchase_date || null,
    warranty_expires_on: input.warranty_expires_on || null,
    last_service_at: input.last_service_at || null,
    installed_at: input.installed_at || null,
    retired_at: input.retired_at || null,
  });
  return data as EquipmentListItem;
}

export async function deleteEquipment(id: string): Promise<void> {
  await api.delete(`/equipment/${id}/`);
}

export async function fetchEquipmentAudit(id: string): Promise<EquipmentAudit> {
  const { data } = await api.get(`/equipment/${id}/audit/`);
  return data as EquipmentAudit;
}

export async function fetchEquipmentInteractions(equipmentId: string): Promise<EquipmentInteractionItem[]> {
  const { data } = await api.get('/equipment/equipment-interactions/', {
    params: { equipment: equipmentId, ordering: '-created_at' },
  });
  return normalizeList<EquipmentInteractionItem>(data);
}

export async function linkEquipmentInteraction(
  equipmentId: string,
  interactionId: string,
  input: { role?: string; note?: string },
): Promise<EquipmentInteractionItem> {
  const { data } = await api.post('/equipment/equipment-interactions/', {
    equipment: equipmentId,
    interaction: interactionId,
    role: input.role ?? 'log',
    note: input.note ?? '',
  });
  return data as EquipmentInteractionItem;
}

export interface EquipmentPurchasePayload {
  amount?: number | null;
  supplier?: string;
  occurred_at?: string | null;
  notes?: string;
}

export interface EquipmentPurchaseResponse extends EquipmentListItem {
  interaction_id: string;
}

export async function registerEquipmentPurchase(
  equipmentId: string,
  payload: EquipmentPurchasePayload,
): Promise<EquipmentPurchaseResponse> {
  const { data } = await api.post(`/equipment/${equipmentId}/register-purchase/`, {
    amount: payload.amount ?? null,
    supplier: payload.supplier ?? '',
    occurred_at: payload.occurred_at ?? null,
    notes: payload.notes ?? '',
  });
  return data as EquipmentPurchaseResponse;
}

export function zoneLabel(zoneId: string | null | undefined, zones: ZoneOption[]): string {
  if (!zoneId) return '—';
  return zones.find((zone) => zone.id === zoneId)?.full_path ?? zones.find((zone) => zone.id === zoneId)?.name ?? '—';
}
