import type { Household } from '@/lib/api/households';

export interface HouseholdManagementProps {
  initialHouseholds: Household[];
  currentUserId: string;
  activeHouseholdId?: string | null;
  switchHouseholdUrl?: string;
}

export type ActivePanel =
  | { id: string; mode: 'edit' }
  | { id: string; mode: 'invite' }
  | { id: string; mode: 'archive' };

export interface HouseholdEditFormValues {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  timezone: string;
  context_notes: string;
  ai_prompt_context: string;
}
