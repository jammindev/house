export interface ContactEmail {
  id: string;
  email: string;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface ContactPhone {
  id: string;
  phone: string;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface ContactAddress {
  id: string;
  address_1: string;
  address_2?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
}

export interface ContactStructure {
  id: string;
  name: string;
  type?: string | null;
}

export interface Contact {
  id: string;
  household: string;
  structure?: ContactStructure | null;
  first_name: string;
  last_name: string;
  position?: string | null;
  notes?: string | null;
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateContactInput {
  first_name: string;
  last_name?: string;
  position?: string;
  notes?: string;
  structure?: string | null;
}

export interface UpdateContactInput {
  first_name?: string;
  last_name?: string;
  position?: string;
  notes?: string;
  structure?: string | null;
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) return '';
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function buildHeaders(householdId?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(householdId ? { 'X-Household-Id': householdId } : {}),
  };
}

function buildJsonHeaders(householdId?: string | null): Record<string, string> {
  return {
    ...buildHeaders(householdId),
    'Content-Type': 'application/json',
    'X-CSRFToken': getCookie('csrftoken'),
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    const last = collator.compare(a.last_name ?? '', b.last_name ?? '');
    if (last !== 0) return last;
    return collator.compare(a.first_name ?? '', b.first_name ?? '');
  });
}

export async function fetchContacts(householdId?: string | null): Promise<Contact[]> {
  const params = new URLSearchParams({ ordering: 'last_name,first_name' });
  const response = await fetch(`/api/contacts/contacts/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const payload = await response.json() as unknown;
  const list = Array.isArray(payload) ? payload : ((payload as { results?: Contact[] }).results ?? []);
  return sortContacts(list as Contact[]);
}

export async function fetchContact(id: string, householdId?: string | null): Promise<Contact> {
  const response = await fetch(`/api/contacts/contacts/${id}/`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<Contact>;
}

export async function createContact(
  input: CreateContactInput,
  householdId?: string | null,
  email?: { email: string; label?: string } | null,
  phone?: { phone: string; label?: string } | null,
): Promise<Contact> {
  const response = await fetch('/api/contacts/contacts/', {
    method: 'POST',
    credentials: 'include',
    headers: buildJsonHeaders(householdId),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const contact = await response.json() as Contact;

  // Create email and phone if provided
  const sideEffects: Promise<unknown>[] = [];

  if (email?.email) {
    sideEffects.push(
      fetch('/api/contacts/emails/', {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(householdId),
        body: JSON.stringify({
          contact: contact.id,
          email: email.email,
          label: email.label ?? '',
          is_primary: true,
        }),
      })
    );
  }

  if (phone?.phone) {
    sideEffects.push(
      fetch('/api/contacts/phones/', {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(householdId),
        body: JSON.stringify({
          contact: contact.id,
          phone: phone.phone,
          label: phone.label ?? '',
          is_primary: true,
        }),
      })
    );
  }

  if (sideEffects.length > 0) await Promise.all(sideEffects);
  return contact;
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
  householdId?: string | null,
): Promise<Contact> {
  const response = await fetch(`/api/contacts/contacts/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildJsonHeaders(householdId),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<Contact>;
}

export async function deleteContact(id: string, householdId?: string | null): Promise<void> {
  const response = await fetch(`/api/contacts/contacts/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(householdId),
    body: JSON.stringify({}),
  });
  if (!response.ok && response.status !== 204) throw new Error(`API error ${response.status}`);
}

export async function fetchContactInteractions(
  contactId: string,
  householdId?: string | null,
  limit = 5,
): Promise<import('./interactions').InteractionListItem[]> {
  const params = new URLSearchParams({
    contact: contactId,
    ordering: '-occurred_at',
    limit: String(limit),
  });
  const response = await fetch(`/api/interactions/interactions/?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(householdId),
  });
  if (!response.ok) return [];
  const payload = await response.json() as unknown;
  const list = Array.isArray(payload) ? payload : ((payload as { results?: unknown[] }).results ?? []);
  return list as import('./interactions').InteractionListItem[];
}
