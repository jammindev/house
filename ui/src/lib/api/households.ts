import { api } from '@/lib/axios';

/** Household API utilities */

export interface HouseholdMember {
  household: string;
  user: string;
  user_email: string;
  user_display_name: string;
  role: 'owner' | 'member';
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  timezone: string;
  context_notes: string;
  ai_prompt_context: string;
  inbound_email_alias: string | null;
  default_household: boolean;
  members_count: number;
  current_user_role: 'owner' | 'member' | null;
  members?: HouseholdMember[];
  archived_at: string | null;
}

export interface CreateHouseholdInput {
  name: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  context_notes?: string;
  ai_prompt_context?: string;
}

export interface UpdateHouseholdInput {
  name?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  context_notes?: string;
  ai_prompt_context?: string;
  default_household?: boolean;
}

export async function fetchHouseholds(): Promise<Household[]> {
  const { data } = await api.get('/households/');
  return Array.isArray(data) ? data : ((data as { results?: Household[] }).results ?? []);
}

export async function createHousehold(input: CreateHouseholdInput): Promise<Household> {
  const { data } = await api.post('/households/', input);
  return data as Household;
}

export async function updateHousehold(id: string, input: UpdateHouseholdInput): Promise<Household> {
  const { data } = await api.patch(`/households/${id}/`, input);
  return data as Household;
}

export async function archiveHousehold(id: string): Promise<void> {
  await api.delete(`/households/${id}/`);
}

/** @deprecated use archiveHousehold */
export const deleteHousehold = archiveHousehold;

export async function leaveHousehold(id: string): Promise<void> {
  await api.post(`/households/${id}/leave/`, {});
}

export async function inviteMember(
  householdId: string,
  email: string,
  role: 'owner' | 'member' = 'member'
): Promise<void> {
  await api.post(`/households/${householdId}/invite/`, { email, role });
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  await api.post(`/households/${householdId}/remove-member/`, { user_id: userId });
}

// --- Invitations ---

export interface HouseholdInvitation {
  id: string;
  household: string;
  household_name: string;
  invited_by_name: string | null;
  role: 'owner' | 'member';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export async function acceptInvitation(
  invitationId: string,
  switchToHousehold = false
): Promise<{ household_id: string; switched: boolean }> {
  const { data } = await api.post(`/households/invitations/${invitationId}/accept/`, { switch: switchToHousehold });
  return data as { household_id: string; switched: boolean };
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await api.post(`/households/invitations/${invitationId}/decline/`, {});
}
