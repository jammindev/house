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
  country: string;
  context_notes: string;
  ai_prompt_context: string;
  inbound_email_alias: string | null;
  default_household: boolean;
  members_count: number;
  members?: HouseholdMember[];
}

export interface CreateHouseholdInput {
  name: string;
  address?: string;
  city?: string;
  country?: string;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function jsonHeaders(csrfToken: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
  };
}

export async function fetchHouseholds(): Promise<Household[]> {
  const response = await fetch('/api/households/', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createHousehold(input: CreateHouseholdInput): Promise<Household> {
  const csrfToken = getCsrfToken();
  const response = await fetch('/api/households/', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json() as Promise<Household>;
}

export async function updateHousehold(id: string, input: Partial<CreateHouseholdInput>): Promise<Household> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<Household>;
}

export async function deleteHousehold(id: string): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/${id}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
}

export async function leaveHousehold(id: string): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/${id}/leave/`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
}

export async function inviteMember(
  householdId: string,
  email: string,
  role: 'owner' | 'member' = 'member'
): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/${householdId}/invite/`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({ email, role }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/${householdId}/remove-member/`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
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
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/invitations/${invitationId}/accept/`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({ switch: switchToHousehold }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json();
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`/api/households/invitations/${invitationId}/decline/`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
}
