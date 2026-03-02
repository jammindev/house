import * as React from 'react';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';

import type { Household } from '@/lib/api/households';

import type { HouseholdManagementProps } from './types';
import { HouseholdActionDialog } from './components/HouseholdActionDialog';
import { useHouseholdManagement } from './hooks/useHouseholdManagement';
import { HouseholdCreateSheet } from './components/HouseholdCreateSheet';
import { HouseholdEditSheet } from './components/HouseholdEditSheet';

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

  const isOwner = (h: Household) =>
    h.current_user_role === 'owner'
    || (h.members?.some((m) => m.user === currentUserId && m.role === 'owner') ?? false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.householdsTitle', { defaultValue: 'Households' })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.noHouseholds', { defaultValue: 'No households yet.' })}
          </p>
        ) : (
          <ul className="space-y-3">
            {households.map((h) => (
              <li key={h.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.members_count} {t('settings.members', { defaultValue: 'members' })}
                    </span>
                    {activeId === h.id && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {t('settings.activeHousehold', { defaultValue: 'Active' })}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {switchHouseholdUrl && households.length > 1 && activeId !== h.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSwitch(h.id)}
                        disabled={switching}
                      >
                        {t('settings.setActiveHousehold', { defaultValue: 'Set as active' })}
                      </Button>
                    )}

                    {isOwner(h) && (
                      <>
                        <HouseholdEditSheet
                          household={h}
                          title={t('settings.editHousehold', { defaultValue: 'Edit household' })}
                          isOpen={activePanel?.id === h.id && activePanel.mode === 'edit'}
                          isSaving={editSaving}
                          values={editForm}
                          onOpen={startEdit}
                          onClose={closePanel}
                          onFieldChange={setEditField}
                          onSubmit={handleEditSave}
                          labels={{
                            edit: t('common.edit', { defaultValue: 'Edit' }),
                            save: t('common.save', { defaultValue: 'Save' }),
                            saving: t('settings.saving', { defaultValue: 'Saving…' }),
                            name: t('settings.householdNamePlaceholder', { defaultValue: 'Household name' }),
                            address: t('settings.address', { defaultValue: 'Address' }),
                            city: t('settings.city', { defaultValue: 'City' }),
                            country: t('settings.country', { defaultValue: 'Country' }),
                            contextNotes: t('settings.contextNotes', { defaultValue: 'Household context notes' }),
                            aiPromptContext: t('settings.aiPromptContext', { defaultValue: 'AI prompt context' }),
                          }}
                        />

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startInvite(h.id)}
                        >
                          {t('settings.invite', { defaultValue: 'Invite' })}
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => startArchive(h.id)}
                          disabled={loading}
                        >
                          {t('common.archive', { defaultValue: 'Archive' })}
                        </Button>
                      </>
                    )}

                    {!isOwner(h) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleLeave(h.id)}
                        disabled={loading}
                      >
                        {t('settings.leave', { defaultValue: 'Leave' })}
                      </Button>
                    )}
                  </div>
                </div>

                {h.members && h.members.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-2 border-l">
                    {h.members.map((m) => (
                      <li key={`${m.household}-${m.user}`}>
                        {m.user_display_name ? m.user_display_name : m.user_email}
                        {' — '}
                        <span className="capitalize">
                          {m.role === 'owner'
                            ? t('settings.owner', { defaultValue: 'Owner' })
                            : t('settings.member', { defaultValue: 'Member' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <HouseholdActionDialog
                  open={activePanel?.id === h.id && activePanel.mode === 'invite'}
                  onOpenChange={(open) => {
                    if (!open) closePanel();
                  }}
                  title={t('settings.invite', { defaultValue: 'Invite' })}
                  description={t('settings.inviteDescription', { defaultValue: 'Enter the email address of the person you want to invite to this household.' })}
                >
                  <form onSubmit={(e) => void handleInvite(e, h.id)} className="space-y-3 pt-1">
                    <Input
                      type="email"
                      placeholder={t('settings.inviteEmailPlaceholder', { defaultValue: 'member@example.com' })}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={closePanel} type="button">
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                      </Button>
                      <Button type="submit" size="sm" disabled={inviting}>
                        {inviting ? t('settings.sending', { defaultValue: 'Sending…' }) : t('settings.send', { defaultValue: 'Send' })}
                      </Button>
                    </div>
                  </form>
                </HouseholdActionDialog>

                <HouseholdActionDialog
                  open={activePanel?.id === h.id && activePanel.mode === 'archive'}
                  onOpenChange={(open) => {
                    if (!open) closePanel();
                  }}
                  title={t('common.archive', { defaultValue: 'Archive' })}
                  description={t('common.confirmArchive', { defaultValue: 'Archive this household? It will no longer be accessible.' })}
                >
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={closePanel} disabled={loading}>
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleArchive(h.id)}
                      disabled={loading}
                    >
                      {loading
                        ? t('settings.saving', { defaultValue: 'Saving…' })
                        : t('common.archive', { defaultValue: 'Archive' })}
                    </Button>
                  </div>
                </HouseholdActionDialog>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t flex justify-end">
          <HouseholdCreateSheet
            title={t('settings.createHousehold', { defaultValue: 'Create household' })}
            isSaving={creating}
            values={createForm}
            onOpen={startCreate}
            onFieldChange={setCreateField}
            onSubmit={handleCreate}
            labels={{
              create: t('settings.createHousehold', { defaultValue: 'Create' }),
              creating: t('settings.creating', { defaultValue: 'Creating…' }),
              name: t('settings.householdNamePlaceholder', { defaultValue: 'Household name' }),
              address: t('settings.address', { defaultValue: 'Address' }),
              city: t('settings.city', { defaultValue: 'City' }),
              country: t('settings.country', { defaultValue: 'Country' }),
              contextNotes: t('settings.contextNotes', { defaultValue: 'Household context notes' }),
              aiPromptContext: t('settings.aiPromptContext', { defaultValue: 'AI prompt context' }),
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
