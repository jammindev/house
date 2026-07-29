import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
import { SettingsSection } from '../SettingsSection';

import type { HouseholdManagementProps } from './types';
import { useHouseholdManagement } from './hooks/useHouseholdManagement';
import { HouseholdCreateSheet } from './components/HouseholdCreateSheet';
import { HouseholdCard } from './components/HouseholdCard';

export function HouseholdManagement({
  currentUserId,
  activeHouseholdId,
  switchHouseholdUrl,
}: HouseholdManagementProps) {
  const {
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
    inviteRole,
    lastCreatedInvitationId,
    inviting,
    startCreate,
    setCreateField,
    setInviteEmail,
    setInviteRole,
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
  } = useHouseholdManagement({
    activeHouseholdId,
    switchHouseholdUrl,
  });

  const { i18n } = useTranslation();
  const locale = i18n.language ?? 'en';

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-lg border border-transparent text-muted-foreground hover:border-border hover:bg-accent/70 hover:text-foreground"
          aria-label={t('common.actions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <HouseholdCreateSheet
          title={t('settings.createHouseholdTitle')}
          isSaving={creating}
          values={createForm}
          onOpen={startCreate}
          onFieldChange={setCreateField}
          onSubmit={handleCreate}
          trigger={
            <DropdownMenuItem>
              {t('settings.createHousehold')}
            </DropdownMenuItem>
          }
          labels={{
            create: t('settings.createHousehold'),
            creating: t('settings.creating'),
            submit: t('settings.createHousehold'),
            submitting: t('settings.creating'),
            name: t('settings.householdName'),
            sectionLocation: t('settings.sectionLocation'),
            address: t('settings.address'),
            city: t('settings.city'),
            postalCode: t('settings.postalCode'),
            country: t('settings.country'),
            countryPlaceholder: t('settings.countryPlaceholder'),
            timezone: t('settings.timezone'),
            timezonePlaceholder: t('settings.timezonePlaceholder'),
            sectionContext: t('settings.sectionContext'),
            contextNotes: t('settings.contextNotes'),
            aiPromptContext: t('settings.aiPromptContext'),
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SettingsSection
      title={t('settings.householdsTitle')}
      actions={actionsMenu}
    >
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.noHouseholds')}
          </p>
        ) : (
          <ul className="space-y-3">
            {households.map((h) => (
              <HouseholdCard
                key={h.id}
                household={h}
                currentUserId={currentUserId}
                locale={locale}
                activeId={activeId}
                householdsCount={households.length}
                switchHouseholdUrl={switchHouseholdUrl}
                switching={switching}
                loading={loading}
                activePanel={activePanel}
                editForm={editForm}
                editSaving={editSaving}
                inviteEmail={inviteEmail}
                inviteRole={inviteRole}
                lastCreatedInvitationId={lastCreatedInvitationId}
                inviting={inviting}
                onSetInviteEmail={setInviteEmail}
                onSetInviteRole={setInviteRole}
                onSwitch={handleSwitch}
                onLeave={handleLeave}
                onArchive={handleArchive}
                onStartEdit={startEdit}
                onStartInvite={startInvite}
                onStartArchive={startArchive}
                onClosePanel={closePanel}
                onSetEditField={setEditField}
                onEditSave={handleEditSave}
                onInvite={handleInvite}
              />
            ))}
          </ul>
        )}

    </SettingsSection>
  );
}
