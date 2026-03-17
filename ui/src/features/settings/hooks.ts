import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { fetchMe, patchMe, type UserProfile, type UpdateProfileInput } from '@/lib/api/users';
import { fetchHouseholds, updateHousehold, type Household, type UpdateHouseholdInput, type HouseholdInvitation } from '@/lib/api/households';

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const p = data as { results?: T[] };
  return Array.isArray(p.results) ? p.results : [];
}

export const settingsKeys = {
  all: ['settings'] as const,
  me: () => [...settingsKeys.all, 'me'] as const,
  households: () => [...settingsKeys.all, 'households'] as const,
  pendingInvitations: () => [...settingsKeys.all, 'pending-invitations'] as const,
};

export function useCurrentUser() {
  return useQuery<UserProfile>({
    queryKey: settingsKeys.me(),
    queryFn: fetchMe,
  });
}

/** @deprecated use useCurrentUser */
export const useMe = useCurrentUser;

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfileInput) => patchMe(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.me() }),
  });
}

export function useHouseholds() {
  return useQuery<Household[]>({
    queryKey: settingsKeys.households(),
    queryFn: fetchHouseholds,
  });
}

export function useUpdateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateHouseholdInput }) =>
      updateHousehold(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.households() }),
  });
}

export function usePendingInvitations() {
  return useQuery<HouseholdInvitation[]>({
    queryKey: settingsKeys.pendingInvitations(),
    queryFn: async () => {
      const { data } = await api.get('/households/invitations/', { params: { status: 'pending' } });
      return normalizeList<HouseholdInvitation>(data);
    },
  });
}
