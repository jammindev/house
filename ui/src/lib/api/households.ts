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
  latitude: number | null;
  longitude: number | null;
  location_label: string;
  context_notes: string;
  ai_prompt_context: string;
  inbound_email_alias: string | null;
  disabled_modules: string[];
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
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string;
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
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string;
  context_notes?: string;
  ai_prompt_context?: string;
  default_household?: boolean;
  disabled_modules?: string[];
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

/** An invitation as its household's owner sees it — carries the link to share. */
export interface InvitationLink {
  id: string;
  email: string;
  role: 'owner' | 'member';
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
  expires_at: string;
  join_url: string;
  is_expired: boolean;
  /** The invited address already had a House account — they also got a notification. */
  has_account: boolean;
}

/**
 * Create an invitation link. `email` is optional: no mail leaves the server, the
 * owner shares `join_url` themselves.
 */
export async function inviteMember(
  householdId: string,
  email: string,
  role: 'owner' | 'member' = 'member'
): Promise<InvitationLink> {
  const { data } = await api.post(`/households/${householdId}/invite/`, { email, role });
  return data as InvitationLink;
}

export async function fetchHouseholdInvitations(householdId: string): Promise<InvitationLink[]> {
  const { data } = await api.get(`/households/${householdId}/invitations/`);
  return Array.isArray(data) ? data : ((data as { results?: InvitationLink[] }).results ?? []);
}

export async function revokeInvitation(householdId: string, invitationId: string): Promise<void> {
  await api.post(`/households/${householdId}/revoke-invitation/`, { invitation_id: invitationId });
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

// --- Joining from a shared link (public, no account required) ---

export interface InvitationPreview {
  household_name: string;
  invited_by_name: string | null;
  /** Set when the invitation is addressed: the account is then pinned to it. */
  email: string;
  role: 'owner' | 'member';
  status: string;
  is_expired: boolean;
}

export interface JoinResult {
  detail: string;
  household_id: string;
  already_member: boolean;
  created_account: boolean;
  /** Present only when an account was just created — the visitor is logged in with it. */
  access?: string;
  refresh?: string;
}

export async function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
  const { data } = await api.get(`/households/join/${token}/`);
  return data as InvitationPreview;
}

export async function joinHousehold(
  token: string,
  payload: { email?: string; password?: string; display_name?: string } = {}
): Promise<JoinResult> {
  const { data } = await api.post(`/households/join/${token}/`, payload);
  return data as JoinResult;
}
