import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';

import type { HouseholdManagementProps } from './types';
import { useHouseholdManagement } from './hooks/useHouseholdManagement';
import { HouseholdCreateSheet } from './components/HouseholdCreateSheet';
import { HouseholdCard } from './components/HouseholdCard';

export function HouseholdManagement({
  initialHouseholds,
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
  } = useHouseholdManagement({
    initialHouseholds,
    activeHouseholdId,
    switchHouseholdUrl,
  });

  const { i18n } = useTranslation();
  const locale = i18n.language ?? 'en';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('settings.householdsTitle', { defaultValue: 'Households' })}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg border border-transparent text-muted-foreground hover:border-border hover:bg-accent/70 hover:text-foreground"
              aria-label={t('common.actions', { defaultValue: 'Actions' })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <HouseholdCreateSheet
              title={t('settings.createHousehold', { defaultValue: 'Create household' })}
              isSaving={creating}
              values={createForm}
              onOpen={startCreate}
              onFieldChange={setCreateField}
              onSubmit={handleCreate}
              trigger={
                <DropdownMenuItem>
                  {t('settings.createHousehold', { defaultValue: 'Create' })}
                </DropdownMenuItem>
              }
              labels={{
                create: t('settings.createHousehold', { defaultValue: 'Create' }),
                creating: t('settings.creating', { defaultValue: 'Creating…' }),
                submit: t('settings.createHousehold', { defaultValue: 'Create' }),
                submitting: t('settings.creating', { defaultValue: 'Creating\u2026' }),
                name: t('settings.householdName', { defaultValue: 'Household name' }),
                sectionLocation: t('settings.sectionLocation', { defaultValue: 'Location' }),
                address: t('settings.address', { defaultValue: 'Address' }),
                city: t('settings.city', { defaultValue: 'City' }),
                postalCode: t('settings.postalCode', { defaultValue: 'Postal code' }),
                country: t('settings.country', { defaultValue: 'Country' }),
                countryPlaceholder: t('settings.countryPlaceholder', { defaultValue: '— Select country —' }),
                timezone: t('settings.timezone', { defaultValue: 'Timezone' }),
                timezonePlaceholder: t('settings.timezonePlaceholder', { defaultValue: '— Select timezone —' }),
                sectionContext: t('settings.sectionContext', { defaultValue: 'Context & AI' }),
                contextNotes: t('settings.contextNotes', { defaultValue: 'Household notes' }),
                aiPromptContext: t('settings.aiPromptContext', { defaultValue: 'AI prompt context' }),
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.noHouseholds', { defaultValue: 'No households yet.' })}
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
                inviting={inviting}
                onSetInviteEmail={setInviteEmail}
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

      </CardContent>
    </Card>
  );
}
