import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { Household } from '@/lib/api/households';
import { useToast } from '@/lib/toast';
import {
  fetchHouseholds,
  createHousehold,
  updateHousehold,
  archiveHousehold,
  leaveHousehold,
  inviteMember,
} from '@/lib/api/households';

import type { ActivePanel, HouseholdEditFormValues } from '../types';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

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
  initialHouseholds: Household[];
  activeHouseholdId?: string | null;
  switchHouseholdUrl?: string;
}

export function useHouseholdManagement({
  initialHouseholds,
  activeHouseholdId,
  switchHouseholdUrl,
}: UseHouseholdManagementParams) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [households, setHouseholds] = React.useState<Household[]>(initialHouseholds);
  const [loading, setLoading] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(activeHouseholdId ?? null);
  const [switching, setSwitching] = React.useState(false);

  const [createForm, setCreateForm] = React.useState<HouseholdEditFormValues>(emptyHouseholdForm());
  const [creating, setCreating] = React.useState(false);

  const [activePanel, setActivePanel] = React.useState<ActivePanel | null>(null);
  const [editForm, setEditForm] = React.useState<HouseholdEditFormValues>(emptyHouseholdForm());
  const [editSaving, setEditSaving] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviting, setInviting] = React.useState(false);

  React.useEffect(() => {
    setHouseholds(initialHouseholds);
  }, [initialHouseholds]);

  async function reload() {
    try {
      const data = await fetchHouseholds();
      setHouseholds(data);
    } catch {
      // silent refresh failure
    }
  }

  async function handleSwitch(id: string) {
    if (id === activeId) return;
    if (!switchHouseholdUrl) return;
    setSwitching(true);
    try {
      const csrfToken = getCsrfToken();
      const res = await fetch(switchHouseholdUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({ household_id: id }),
      });
      if (!res.ok) throw new Error('Failed');
      setActiveId(id);
      toast({ description: t('settings.householdSwitched', { defaultValue: 'Active household changed.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Request failed.' }), variant: 'destructive' });
    } finally {
      setSwitching(false);
    }
  }

  function startCreate() {
    setCreateForm(emptyHouseholdForm());
  }

  function setCreateField<K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) {
    setCreateForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleCreate(): Promise<boolean> {
    const trimmed = createForm.name.trim();
    if (!trimmed) {
      toast({ description: t('settings.householdNameRequired'), variant: 'destructive' });
      return false;
    }
    setCreating(true);
    try {
      await createHousehold({
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
      await reload();
      toast({ description: t('settings.householdCreated'), variant: 'success' });
      return true;
    } catch {
      toast({ description: t('settings.householdCreateFailed'), variant: 'destructive' });
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id: string) {
    setLoading(true);
    try {
      await archiveHousehold(id);
      await reload();
      setActivePanel(null);
      toast({ description: t('settings.householdArchived', { defaultValue: 'Household archived.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Request failed.' }), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave(id: string) {
    if (!confirm(t('common.confirmLeave', { defaultValue: 'Leave this household?' }))) return;
    setLoading(true);
    try {
      await leaveHousehold(id);
      await reload();
      toast({ description: t('settings.householdLeft', { defaultValue: 'Left household.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Request failed.' }), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
    setEditForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleEditSave(id: string) {
    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      toast({ description: t('settings.householdNameRequired'), variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      await updateHousehold(id, {
        name: trimmedName,
        address: editForm.address.trim(),
        city: editForm.city.trim(),
        postal_code: editForm.postal_code.trim(),
        country: editForm.country.trim(),
        timezone: editForm.timezone.trim(),
        context_notes: editForm.context_notes.trim(),
        ai_prompt_context: editForm.ai_prompt_context.trim(),
      });
      await reload();
      setActivePanel(null);
      toast({ description: t('settings.householdUpdated', { defaultValue: 'Household updated.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Request failed.' }), variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleInvite(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(id, inviteEmail.trim());
      setInviteEmail('');
      setActivePanel(null);
      await reload();
      toast({ description: t('settings.memberInvited', { defaultValue: 'Member invited.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.inviteFailed', { defaultValue: 'Failed to invite member.' }), variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  }

  return {
    t,
    households,
    loading,
    activeId,
    switching,
    createForm,
    creating,
    activePanel,
    editForm,
    editSaving,
    inviteEmail,
    inviting,
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
