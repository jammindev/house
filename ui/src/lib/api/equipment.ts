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
  householdId?: string;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function buildHeaders(householdId?: string, withJson = false) {
  const csrfToken = getCookie('csrftoken');

  return {
    Accept: 'application/json',
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...(householdId ? { 'X-Household-Id': householdId } : {}),
  };
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
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);
  if (options.zone) params.set('zone', options.zone);
  params.set('ordering', options.ordering ?? 'name');

  const response = await fetch(`/api/equipment/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(options.householdId),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeList<EquipmentListItem>(payload);
}

export async function fetchEquipment(id: string, householdId?: string): Promise<EquipmentListItem> {
  const response = await fetch(`/api/equipment/${id}/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as EquipmentListItem;
}

export async function createEquipment(input: EquipmentPayload, householdId?: string): Promise<EquipmentListItem> {
  const response = await fetch('/api/equipment/', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(householdId, true),
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as EquipmentListItem;
}

export async function updateEquipment(id: string, input: EquipmentPayload, householdId?: string): Promise<EquipmentListItem> {
  const response = await fetch(`/api/equipment/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(householdId, true),
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as EquipmentListItem;
}

export async function deleteEquipment(id: string, householdId?: string): Promise<void> {
  const response = await fetch(`/api/equipment/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
}

export async function fetchEquipmentAudit(id: string, householdId?: string): Promise<EquipmentAudit> {
  const response = await fetch(`/api/equipment/${id}/audit/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as EquipmentAudit;
}

export async function fetchEquipmentInteractions(equipmentId: string, householdId?: string): Promise<EquipmentInteractionItem[]> {
  const params = new URLSearchParams();
  params.set('equipment', equipmentId);
  params.set('ordering', '-created_at');

  const response = await fetch(`/api/equipment/equipment-interactions/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeList<EquipmentInteractionItem>(payload);
}

export async function linkEquipmentInteraction(
  equipmentId: string,
  interactionId: string,
  input: { role?: string; note?: string },
  householdId?: string
): Promise<EquipmentInteractionItem> {
  const response = await fetch('/api/equipment/equipment-interactions/', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(householdId, true),
    body: JSON.stringify({
      equipment: equipmentId,
      interaction: interactionId,
      role: input.role ?? 'log',
      note: input.note ?? '',
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as EquipmentInteractionItem;
}

export function zoneLabel(zoneId: string | null | undefined, zones: ZoneOption[]): string {
  if (!zoneId) return '—';
  return zones.find((zone) => zone.id === zoneId)?.full_path ?? zones.find((zone) => zone.id === zoneId)?.name ?? '—';
}
