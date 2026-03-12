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

function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) return '';
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function buildHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
  };
}

function buildJsonHeaders(): Record<string, string> {
  return {
    ...buildHeaders(),
    'Content-Type': 'application/json',
    'X-CSRFToken': getCookie('csrftoken'),
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

export async function fetchStructures(): Promise<Structure[]> {
  const params = new URLSearchParams({ ordering: 'name' });
  const response = await fetch(`/api/contacts/structures/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const payload = await response.json() as unknown;
  const list = Array.isArray(payload) ? payload : ((payload as { results?: Structure[] }).results ?? []);
  return [...(list as Structure[])].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''));
}

export async function fetchStructure(id: string): Promise<Structure> {
  const response = await fetch(`/api/contacts/structures/${id}/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<Structure>;
}

async function syncStructureRelations(
  structureId: string,
  values: StructureFormValues,
  existingStructure?: Structure,
) {
  const jsonHeaders = buildJsonHeaders();

  // ── Addresses ──────────────────────────────────────────────────────────
  const existingAddressIds = new Set((existingStructure?.addresses ?? []).map((a) => a.id).filter(Boolean) as string[]);
  const addressOps: Promise<unknown>[] = [];

  for (const addr of values.addresses ?? []) {
    if (!addr.address_1?.trim()) continue;
    if (addr.id && existingAddressIds.has(addr.id)) {
      // update
      addressOps.push(
        fetch(`/api/contacts/addresses/${addr.id}/`, {
          method: 'PATCH',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...addr, structure: structureId }),
        })
      );
      existingAddressIds.delete(addr.id);
    } else {
      // create
      addressOps.push(
        fetch('/api/contacts/addresses/', {
          method: 'POST',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...addr, structure: structureId }),
        })
      );
    }
  }
  // delete removed
  for (const deletedId of existingAddressIds) {
    addressOps.push(
      fetch(`/api/contacts/addresses/${deletedId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      })
    );
  }

  // ── Emails ─────────────────────────────────────────────────────────────
  const existingEmails = existingStructure?.emails ?? [];
  const emailOps: Promise<unknown>[] = [];

  for (const em of values.emails ?? []) {
    if (!em.email?.trim()) continue;
    const existing = existingEmails.find((e) => e.is_primary === em.is_primary);
    if (existing) {
      emailOps.push(
        fetch(`/api/contacts/emails/${existing.id}/`, {
          method: 'PATCH',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...em, structure: structureId }),
        })
      );
    } else {
      emailOps.push(
        fetch('/api/contacts/emails/', {
          method: 'POST',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...em, structure: structureId }),
        })
      );
    }
  }

  // ── Phones ─────────────────────────────────────────────────────────────
  const existingPhones = existingStructure?.phones ?? [];
  const phoneOps: Promise<unknown>[] = [];

  for (const ph of values.phones ?? []) {
    if (!ph.phone?.trim()) continue;
    const existing = existingPhones.find((p) => p.is_primary === ph.is_primary);
    if (existing) {
      phoneOps.push(
        fetch(`/api/contacts/phones/${existing.id}/`, {
          method: 'PATCH',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...ph, structure: structureId }),
        })
      );
    } else {
      phoneOps.push(
        fetch('/api/contacts/phones/', {
          method: 'POST',
          credentials: 'include',
          headers: jsonHeaders,
          body: JSON.stringify({ ...ph, structure: structureId }),
        })
      );
    }
  }

  await Promise.all([...addressOps, ...emailOps, ...phoneOps]);
}

export async function createStructure(
  values: StructureFormValues,
): Promise<Structure> {
  const { addresses: _a, emails: _e, phones: _p, ...base } = values;
  const response = await fetch('/api/contacts/structures/', {
    method: 'POST',
    credentials: 'include',
    headers: buildJsonHeaders(),
    body: JSON.stringify(base),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const structure = await response.json() as Structure;
  await syncStructureRelations(structure.id, values);
  return structure;
}

export async function updateStructure(
  id: string,
  values: StructureFormValues,
  existing?: Structure,
): Promise<Structure> {
  const { addresses: _a, emails: _e, phones: _p, ...base } = values;
  const response = await fetch(`/api/contacts/structures/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildJsonHeaders(),
    body: JSON.stringify(base),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const structure = await response.json() as Structure;
  await syncStructureRelations(structure.id, values, existing);
  return structure;
}

export async function deleteStructure(id: string): Promise<void> {
  const response = await fetch(`/api/contacts/structures/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok && response.status !== 204) throw new Error(`API error ${response.status}`);
}

export async function fetchStructureInteractions(
  structureId: string,
  limit = 5,
): Promise<import('./interactions').InteractionListItem[]> {
  const params = new URLSearchParams({
    structure: structureId,
    ordering: '-occurred_at',
    limit: String(limit),
  });
  const response = await fetch(`/api/interactions/interactions/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });
  if (!response.ok) return [];
  const payload = await response.json() as unknown;
  const list = Array.isArray(payload) ? payload : ((payload as { results?: unknown[] }).results ?? []);
  return list as import('./interactions').InteractionListItem[];
}
