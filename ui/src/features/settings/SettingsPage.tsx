import { useMe, useHouseholds, usePendingInvitations } from './hooks';
import UserSettings from '@apps/app_settings/react/UserSettings';

export default function SettingsPage() {
  const { data: user, isLoading: userLoading } = useMe();
  const { data: households = [], isLoading: householdsLoading } = useHouseholds();
  const { data: pendingInvitations = [] } = usePendingInvitations();

  if (userLoading || householdsLoading || !user) {
    return null;
  }

  return (
    <UserSettings
      initialUser={user}
      initialHouseholds={households}
      initialPendingInvitations={pendingInvitations}
      switchHouseholdUrl="/api/households/switch/"
    />
  );
}
