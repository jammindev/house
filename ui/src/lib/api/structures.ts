import { api } from '@/lib/axios';

export interface StructureEmail {
  id: string;
  email: string;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface StructurePhone {
  id: string;
  phone: string;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface StructureAddress {
  id?: string;
  address_1: string;
  address_2?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface Structure {
  id: string;
  household: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  emails: StructureEmail[];
  phones: StructurePhone[];
  addresses: StructureAddress[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StructureFormValues {
  name: string;
  type?: string;
  description?: string;
  website?: string;
  tags?: string[];
  addresses?: StructureAddress[];
  emails?: Array<{ email: string; label?: string; is_primary?: boolean }>;
  phones?: Array<{ phone: string; label?: string; is_primary?: boolean }>;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

export async function fetchStructures(): Promise<Structure[]> {
  const { data } = await api.get('/contacts/structures/', { params: { ordering: 'name' } });
  const list = Array.isArray(data) ? data : ((data as { results?: Structure[] }).results ?? []);
  return [...(list as Structure[])].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''));
}

export async function fetchStructure(id: string): Promise<Structure> {
  const { data } = await api.get(`/contacts/structures/${id}/`);
  return data as Structure;
}

async function syncStructureRelations(
  structureId: string,
  values: StructureFormValues,
  existingStructure?: Structure,
) {
  // ── Addresses ──────────────────────────────────────────────────────────
  const existingAddressIds = new Set((existingStructure?.addresses ?? []).map((a) => a.id).filter(Boolean) as string[]);
  const addressOps: Promise<unknown>[] = [];

  for (const addr of values.addresses ?? []) {
    if (!addr.address_1?.trim()) continue;
    if (addr.id && existingAddressIds.has(addr.id)) {
      // update
      addressOps.push(api.patch(`/contacts/addresses/${addr.id}/`, { ...addr, structure: structureId }));
      existingAddressIds.delete(addr.id);
    } else {
      // create
      addressOps.push(api.post('/contacts/addresses/', { ...addr, structure: structureId }));
    }
  }
  // delete removed
  for (const deletedId of existingAddressIds) {
    addressOps.push(api.delete(`/contacts/addresses/${deletedId}/`));
  }

  // ── Emails ─────────────────────────────────────────────────────────────
  const existingEmails = existingStructure?.emails ?? [];
  const emailOps: Promise<unknown>[] = [];

  for (const em of values.emails ?? []) {
    if (!em.email?.trim()) continue;
    const existing = existingEmails.find((e) => e.is_primary === em.is_primary);
    if (existing) {
      emailOps.push(api.patch(`/contacts/emails/${existing.id}/`, { ...em, structure: structureId }));
    } else {
      emailOps.push(api.post('/contacts/emails/', { ...em, structure: structureId }));
    }
  }

  // ── Phones ─────────────────────────────────────────────────────────────
  const existingPhones = existingStructure?.phones ?? [];
  const phoneOps: Promise<unknown>[] = [];

  for (const ph of values.phones ?? []) {
    if (!ph.phone?.trim()) continue;
    const existing = existingPhones.find((p) => p.is_primary === ph.is_primary);
    if (existing) {
      phoneOps.push(api.patch(`/contacts/phones/${existing.id}/`, { ...ph, structure: structureId }));
    } else {
      phoneOps.push(api.post('/contacts/phones/', { ...ph, structure: structureId }));
    }
  }

  await Promise.all([...addressOps, ...emailOps, ...phoneOps]);
}

export async function createStructure(
  values: StructureFormValues,
): Promise<Structure> {
  const { addresses: _a, emails: _e, phones: _p, ...base } = values;
  const { data } = await api.post('/contacts/structures/', base);
  const structure = data as Structure;
  await syncStructureRelations(structure.id, values);
  return structure;
}

export async function updateStructure(
  id: string,
  values: StructureFormValues,
  existing?: Structure,
): Promise<Structure> {
  const { addresses: _a, emails: _e, phones: _p, ...base } = values;
  const { data } = await api.patch(`/contacts/structures/${id}/`, base);
  const structure = data as Structure;
  await syncStructureRelations(structure.id, values, existing);
  return structure;
}

export async function deleteStructure(id: string): Promise<void> {
  await api.delete(`/contacts/structures/${id}/`);
}

export async function fetchStructureInteractions(
  structureId: string,
  limit = 5,
): Promise<import('./interactions').InteractionListItem[]> {
  const { data } = await api.get('/interactions/interactions/', {
    params: { structure: structureId, ordering: '-occurred_at', limit: String(limit) },
  });
  const list = Array.isArray(data) ? data : ((data as { results?: unknown[] }).results ?? []);
  return list as import('./interactions').InteractionListItem[];
}
