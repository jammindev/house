import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useCurrentUser } from './hooks';
import { ProfileSection } from './components/ProfileSection';
import { ThemeSection } from './components/ThemeSection';
import { ChangePasswordSection } from './components/ChangePasswordSection';
import { HouseholdManagement } from './components/HouseholdManagement';
import { PendingInvitations } from './components/PendingInvitations';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <PendingInvitations />
      <HouseholdManagement
        currentUserId={user.id}
        switchHouseholdUrl="/api/households/switch/"
      />
      <ProfileSection />
      <ThemeSection />
      <ChangePasswordSection />
    </div>
  );
}
