import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { Household } from '@/lib/api/households';
import {
  useHouseholds,
  useCreateHousehold,
  useArchiveHousehold,
  useLeaveHousehold,
  useInviteMember,
  useSwitchHousehold,
} from '../../../hooks';

import type { ActivePanel, HouseholdEditFormValues } from '../types';
import { useUpdateHousehold } from '../../../hooks';
import { useToast } from '@/lib/toast';

function initialEditForm(household: Household): HouseholdEditFormValues {
  return {
    name: household.name ?? '',
    address: household.address ?? '',
    city: household.city ?? '',
    postal_code: household.postal_code ?? '',
    country: household.country ?? '',
    timezone: household.timezone ?? '',
    context_notes: household.context_notes ?? '',
    ai_prompt_context: household.ai_prompt_context ?? '',
  };
}

function emptyHouseholdForm(): HouseholdEditFormValues {
  return {
    name: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    timezone: '',
    context_notes: '',
    ai_prompt_context: '',
  };
}

interface UseHouseholdManagementParams {
  activeHouseholdId?: string | null;
  switchHouseholdUrl?: string;
}

export function useHouseholdManagement({ activeHouseholdId, switchHouseholdUrl }: UseHouseholdManagementParams) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: households = [], isLoading: loading } = useHouseholds();
  const createMutation = useCreateHousehold();
  const archiveMutation = useArchiveHousehold();
  const leaveMutation = useLeaveHousehold();
  const inviteMutation = useInviteMember();
  const updateMutation = useUpdateHousehold();
  const switchMutation = useSwitchHousehold(switchHouseholdUrl ?? '');

  const [activeId, setActiveId] = React.useState<string | null>(activeHouseholdId ?? null);

  const [createForm, setCreateForm] = React.useState<HouseholdEditFormValues>(emptyHouseholdForm());
  const [activePanel, setActivePanel] = React.useState<ActivePanel | null>(null);
  const [editForm, setEditForm] = React.useState<HouseholdEditFormValues>(emptyHouseholdForm());
  const [inviteEmail, setInviteEmail] = React.useState('');

  async function handleSwitch(id: string) {
    if (id === activeId || !switchHouseholdUrl) return;
    await switchMutation.mutateAsync(id);
    setActiveId(id);
  }

  function startCreate() {
    setCreateForm(emptyHouseholdForm());
  }

  function setCreateField<K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(): Promise<boolean> {
    const trimmed = createForm.name.trim();
    if (!trimmed) {
      toast({ description: t('settings.householdNameRequired'), variant: 'destructive' });
      return false;
    }
    try {
      await createMutation.mutateAsync({
        name: trimmed,
        address: createForm.address.trim(),
        city: createForm.city.trim(),
        postal_code: createForm.postal_code.trim(),
        country: createForm.country.trim(),
        timezone: createForm.timezone.trim(),
        context_notes: createForm.context_notes.trim(),
        ai_prompt_context: createForm.ai_prompt_context.trim(),
      });
      setCreateForm(emptyHouseholdForm());
      return true;
    } catch {
      return false;
    }
  }

  async function handleArchive(id: string) {
    await archiveMutation.mutateAsync(id);
    setActivePanel(null);
  }

  async function handleLeave(id: string) {
    if (!confirm(t('common.confirmLeave'))) return;
    await leaveMutation.mutateAsync(id);
  }

  function startEdit(household: Household) {
    setEditForm(initialEditForm(household));
    setActivePanel({ id: household.id, mode: 'edit' });
  }

  function startInvite(id: string) {
    setInviteEmail('');
    setActivePanel({ id, mode: 'invite' });
  }

  function startArchive(id: string) {
    setActivePanel({ id, mode: 'archive' });
  }

  function closePanel() {
    setActivePanel(null);
  }

  function setEditField<K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleEditSave(id: string) {
    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      toast({ description: t('settings.householdNameRequired'), variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id,
        payload: {
          name: trimmedName,
          address: editForm.address.trim(),
          city: editForm.city.trim(),
          postal_code: editForm.postal_code.trim(),
          country: editForm.country.trim(),
          timezone: editForm.timezone.trim(),
          context_notes: editForm.context_notes.trim(),
          ai_prompt_context: editForm.ai_prompt_context.trim(),
        },
      });
      toast({ description: t('settings.householdUpdated'), variant: 'success' });
      setActivePanel(null);
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  }

  async function handleInvite(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await inviteMutation.mutateAsync({ householdId: id, email: inviteEmail.trim() });
    setInviteEmail('');
    setActivePanel(null);
  }

  return {
    t,
    households,
    loading,
    activeId,
    switching: switchMutation.isPending,
    createForm,
    creating: createMutation.isPending,
    isCreateSheetOpen: false,
    setIsCreateSheetOpen: (_: boolean) => {},
    activePanel,
    editForm,
    editSaving: updateMutation.isPending,
    inviteEmail,
    inviting: inviteMutation.isPending,
    startCreate,
    setCreateField,
    setInviteEmail,
    handleSwitch,
    handleCreate,
    handleArchive,
    handleLeave,
    startEdit,
    startInvite,
    startArchive,
    closePanel,
    setEditField,
    handleEditSave,
    handleInvite,
  };
}
