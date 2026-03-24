import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/lib/toast';
import { fetchMe, patchMe, uploadAvatar, deleteAvatar, changePassword, type UserProfile, type UpdateProfileInput } from '@/lib/api/users';
import {
  fetchHouseholds,
  createHousehold,
  updateHousehold,
  archiveHousehold,
  leaveHousehold,
  inviteMember,
  acceptInvitation,
  declineInvitation,
  type Household,
  type CreateHouseholdInput,
  type UpdateHouseholdInput,
  type HouseholdInvitation,
} from '@/lib/api/households';

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const p = data as { results?: T[] };
  return Array.isArray(p.results) ? p.results : [];
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export const settingsKeys = {
  all: ['settings'] as const,
  me: () => [...settingsKeys.all, 'me'] as const,
  households: () => [...settingsKeys.all, 'households'] as const,
  pendingInvitations: () => [...settingsKeys.all, 'pending-invitations'] as const,
};

// --- User ---

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

export function useUploadAvatar() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.me() });
      toast({ description: t('settings.avatarUpdated'), variant: 'success' });
    },
    onError: (err) => {
      toast({
        description: err instanceof Error ? err.message : t('settings.requestFailed'),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.me() });
      toast({ description: t('settings.avatarRemoved'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}

export function useChangePassword() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ newPassword, confirmPassword }: { newPassword: string; confirmPassword: string }) =>
      changePassword(newPassword, confirmPassword),
    onSuccess: () => toast({ description: t('settings.passwordUpdated'), variant: 'success' }),
    onError: (err) => {
      toast({
        description: err instanceof Error ? err.message : t('settings.requestFailed'),
        variant: 'destructive',
      });
    },
  });
}

// --- Households ---

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

export function useCreateHousehold() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: CreateHouseholdInput) => createHousehold(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.households() });
      toast({ description: t('settings.householdCreated'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.householdCreateFailed'), variant: 'destructive' }),
  });
}

export function useArchiveHousehold() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => archiveHousehold(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.households() });
      toast({ description: t('settings.householdArchived'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}

export function useLeaveHousehold() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => leaveHousehold(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.households() });
      toast({ description: t('settings.householdLeft'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ householdId, email }: { householdId: string; email: string }) =>
      inviteMember(householdId, email),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.households() });
      toast({ description: t('settings.memberInvited'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.inviteFailed'), variant: 'destructive' }),
  });
}

export function useSwitchHousehold(switchHouseholdUrl: string) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const csrfToken = getCsrfToken();
      const res = await fetch(switchHouseholdUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({ household_id: householdId }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => toast({ description: t('settings.householdSwitched'), variant: 'success' }),
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}

// --- Invitations ---

export function usePendingInvitations() {
  return useQuery<HouseholdInvitation[]>({
    queryKey: settingsKeys.pendingInvitations(),
    queryFn: async () => {
      const { data } = await api.get('/households/invitations/', { params: { status: 'pending' } });
      return normalizeList<HouseholdInvitation>(data);
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ invitationId, switchToHousehold }: { invitationId: string; switchToHousehold: boolean }) =>
      acceptInvitation(invitationId, switchToHousehold),
    onSuccess: (_, { invitationId: _id }) => {
      void qc.invalidateQueries({ queryKey: settingsKeys.pendingInvitations() });
      void qc.invalidateQueries({ queryKey: settingsKeys.households() });
      toast({ description: t('invitations.acceptedGeneric'), variant: 'success' });
    },
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}

export function useDeclineInvitation() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (invitationId: string) => declineInvitation(invitationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.pendingInvitations() });
      toast({ description: t('invitations.declinedGeneric'), variant: 'default' });
    },
    onError: () => toast({ description: t('settings.requestFailed'), variant: 'destructive' }),
  });
}
