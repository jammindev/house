import * as React from 'react';

import type { UserProfile } from '@/lib/api/users';
import type { Household, HouseholdInvitation } from '@/lib/api/households';
import { fetchHouseholds } from '@/lib/api/households';
import { HouseholdManagement } from './components/HouseholdManagement';
import { PendingInvitations } from './components/PendingInvitations';
import { ProfileSection } from './components/ProfileSection';
import { ThemeSection } from './components/ThemeSection';
import { ChangePasswordSection } from './components/ChangePasswordSection';

interface UserSettingsProps {
  initialUser: UserProfile;
  initialHouseholds: Household[];
  activeHouseholdId?: string | null;
  switchHouseholdUrl?: string;
  initialPendingInvitations?: HouseholdInvitation[];
}

export default function UserSettings({ initialUser, initialHouseholds, activeHouseholdId, switchHouseholdUrl, initialPendingInvitations = [] }: UserSettingsProps) {
  const [user, setUser] = React.useState<UserProfile>(initialUser);
  const [households, setHouseholds] = React.useState<Household[]>(initialHouseholds);

  async function handleInvitationAccepted(_householdId: string, switched: boolean) {
    if (!switched) {
      try {
        const updated = await fetchHouseholds();
        setHouseholds(updated);
      } catch {
        // silently ignore — the user can reload if needed
      }
    }
  }

  return (
    <div className="space-y-6">
      <PendingInvitations
        initialInvitations={initialPendingInvitations}
        activeHouseholdId={activeHouseholdId}
        onAccepted={(id, switched) => void handleInvitationAccepted(id, switched)}
      />

      <HouseholdManagement
        initialHouseholds={households}
        currentUserId={user.id}
        activeHouseholdId={activeHouseholdId}
        switchHouseholdUrl={switchHouseholdUrl}
      />

      <ProfileSection user={user} onUserUpdate={setUser} />

      <ThemeSection user={user} onUserUpdate={setUser} />

      <ChangePasswordSection />
    </div>
  );
}
