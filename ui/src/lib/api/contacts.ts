import { api } from '@/lib/axios';

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

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    const last = collator.compare(a.last_name ?? '', b.last_name ?? '');
    if (last !== 0) return last;
    return collator.compare(a.first_name ?? '', b.first_name ?? '');
  });
}

export async function fetchContacts(): Promise<Contact[]> {
  const { data } = await api.get('/contacts/contacts/', {
    params: { ordering: 'last_name,first_name' },
  });
  const list = Array.isArray(data) ? data : ((data as { results?: Contact[] }).results ?? []);
  return sortContacts(list as Contact[]);
}

export async function fetchContact(id: string): Promise<Contact> {
  const { data } = await api.get(`/contacts/contacts/${id}/`);
  return data as Contact;
}

export async function createContact(
  input: CreateContactInput,
  email?: { email: string; label?: string } | null,
  phone?: { phone: string; label?: string } | null,
): Promise<Contact> {
  const { data } = await api.post('/contacts/contacts/', input);
  const contact = data as Contact;

  // Create email and phone if provided
  const sideEffects: Promise<unknown>[] = [];

  if (email?.email) {
    sideEffects.push(
      api.post('/contacts/emails/', {
        contact: contact.id,
        email: email.email,
        label: email.label ?? '',
        is_primary: true,
      })
    );
  }

  if (phone?.phone) {
    sideEffects.push(
      api.post('/contacts/phones/', {
        contact: contact.id,
        phone: phone.phone,
        label: phone.label ?? '',
        is_primary: true,
      })
    );
  }

  if (sideEffects.length > 0) await Promise.all(sideEffects);
  return contact;
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
): Promise<Contact> {
  const { data } = await api.patch(`/contacts/contacts/${id}/`, input);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/contacts/contacts/${id}/`);
}

export async function fetchContactInteractions(
  contactId: string,
  limit = 5,
): Promise<import('./interactions').InteractionListItem[]> {
  const { data } = await api.get('/interactions/interactions/', {
    params: { contact: contactId, ordering: '-occurred_at', limit: String(limit) },
  });
  const list = Array.isArray(data) ? data : ((data as { results?: unknown[] }).results ?? []);
  return list as import('./interactions').InteractionListItem[];
}
