import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContacts, createContact, updateContact, deleteContact,
  type Contact, type CreateContactInput, type UpdateContactInput,
} from '@/lib/api/contacts';
import {
  fetchStructures, createStructure, updateStructure, deleteStructure,
  type Structure, type StructureFormValues,
} from '@/lib/api/structures';

// ── Query key factories ───────────────────────────────────────────────────────

export const contactKeys = {
  all: ['contacts'] as const,
  list: (filters?: { search?: string }) => [...contactKeys.all, 'list', filters ?? {}] as const,
};

export const structureKeys = {
  all: ['structures'] as const,
  list: (filters?: { search?: string }) => [...structureKeys.all, 'list', filters ?? {}] as const,
};

// ── Contacts ─────────────────────────────────────────────────────────────────

export function useContacts(filters?: { search?: string }) {
  return useQuery({
    queryKey: contactKeys.list(filters),
    queryFn: () => fetchContacts(),
    select: filters?.search
      ? (data: Contact[]) => {
          const q = filters.search!.toLowerCase();
          return data.filter(
            (c) =>
              c.first_name?.toLowerCase().includes(q) ||
              c.last_name?.toLowerCase().includes(q) ||
              c.emails.some((e) => e.email?.toLowerCase().includes(q)) ||
              c.structure?.name?.toLowerCase().includes(q),
          );
        }
      : undefined,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      email,
      phone,
    }: {
      input: CreateContactInput;
      email?: { email: string; label?: string } | null;
      phone?: { phone: string; label?: string } | null;
    }) => createContact(input, email, phone),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContactInput }) =>
      updateContact(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

// ── Structures ────────────────────────────────────────────────────────────────

export function useStructures(filters?: { search?: string }) {
  return useQuery({
    queryKey: structureKeys.list(filters),
    queryFn: () => fetchStructures(),
    select: filters?.search
      ? (data: Structure[]) => {
          const q = filters.search!.toLowerCase();
          return data.filter(
            (s) =>
              s.name?.toLowerCase().includes(q) ||
              s.type?.toLowerCase().includes(q) ||
              s.website?.toLowerCase().includes(q),
          );
        }
      : undefined,
  });
}

export function useCreateStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: StructureFormValues) => createStructure(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: structureKeys.all }),
  });
}

export function useUpdateStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values, existing }: { id: string; values: StructureFormValues; existing?: Structure }) =>
      updateStructure(id, values, existing),
    onSuccess: () => qc.invalidateQueries({ queryKey: structureKeys.all }),
  });
}

export function useDeleteStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStructure,
    onSuccess: () => qc.invalidateQueries({ queryKey: structureKeys.all }),
  });
}
