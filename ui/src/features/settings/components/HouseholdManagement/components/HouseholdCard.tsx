import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
import type { Household } from '@/lib/api/households';

import type { ActivePanel, HouseholdEditFormValues } from '../types';
import { HouseholdActionDialog } from './HouseholdActionDialog';
import { HouseholdEditSheet } from './HouseholdEditSheet';
import { InvitePanel } from './InvitePanel';

interface HouseholdCardProps {
  household: Household;
  currentUserId: string;
  locale: string;
  activeId: string | null;
  householdsCount: number;
  switchHouseholdUrl?: string;
  switching: boolean;
  loading: boolean;
  activePanel: ActivePanel | null;
  editForm: HouseholdEditFormValues;
  editSaving: boolean;
  inviteEmail: string;
  inviteRole: 'owner' | 'member';
  lastCreatedInvitationId: string | null;
  inviting: boolean;
  onSetInviteEmail: (value: string) => void;
  onSetInviteRole: (value: 'owner' | 'member') => void;
  onSwitch: (householdId: string) => Promise<void>;
  onLeave: (householdId: string) => Promise<void>;
  onArchive: (householdId: string) => Promise<void>;
  onStartEdit: (household: Household) => void;
  onStartInvite: (householdId: string) => void;
  onStartArchive: (householdId: string) => void;
  onClosePanel: () => void;
  onSetEditField: <K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) => void;
  onEditSave: (householdId: string) => Promise<void>;
  onInvite: (event: React.FormEvent, householdId: string) => Promise<void>;
}

function HouseholdAddress({ household, locale }: { household: Household; locale: string }) {
  const lines: string[] = [];

  if (household.address) lines.push(household.address);

  const cityParts = [household.city, household.postal_code].filter(Boolean);
  if (cityParts.length) lines.push(cityParts.join('\u00a0'));

  if (household.country) {
    try {
      const dn = new Intl.DisplayNames([locale], { type: 'region' });
      lines.push(dn.of(household.country) ?? household.country);
    } catch {
      lines.push(household.country);
    }
  }

  if (!lines.length) return null;

  return (
    <address className="not-italic text-xs text-muted-foreground pl-2 border-l space-y-0.5">
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </address>
  );
}

export function HouseholdCard({
  household,
  currentUserId,
  locale,
  activeId,
  householdsCount,
  switchHouseholdUrl,
  switching,
  loading,
  activePanel,
  editForm,
  editSaving,
  inviteEmail,
  inviteRole,
  lastCreatedInvitationId,
  inviting,
  onSetInviteEmail,
  onSetInviteRole,
  onSwitch,
  onLeave,
  onArchive,
  onStartEdit,
  onStartInvite,
  onStartArchive,
  onClosePanel,
  onSetEditField,
  onEditSave,
  onInvite,
}: HouseholdCardProps) {
  const { t } = useTranslation();

  const isOwner =
    household.current_user_role === 'owner'
    || (household.members?.some((member) => member.user === currentUserId && member.role === 'owner') ?? false);

  const canSwitch = Boolean(switchHouseholdUrl) && householdsCount > 1 && activeId !== household.id;

  return (
    <li className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{household.name}</span>
          <span className="text-xs text-muted-foreground">
            {household.members_count} {t('settings.members')}
          </span>
          {activeId === household.id && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {t('settings.activeHousehold')}
            </span>
          )}
        </div>

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
            {canSwitch && (
              <DropdownMenuItem onSelect={() => void onSwitch(household.id)} disabled={switching}>
                {t('settings.setActiveHousehold')}
              </DropdownMenuItem>
            )}

            {isOwner ? (
              <>
                {canSwitch && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => onStartEdit(household)}>
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onStartInvite(household.id)}>
                  {t('settings.invite')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onStartArchive(household.id)} className="text-destructive focus:text-destructive">
                  {t('common.archive')}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {canSwitch && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => void onLeave(household.id)} disabled={loading}>
                  {t('settings.leave')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {household.members && household.members.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 pl-2 border-l">
          {household.members.map((member) => (
            <li key={`${member.household}-${member.user}`}>
              {member.user_display_name ? member.user_display_name : member.user_email}
              {' — '}
              <span className="capitalize">
                {member.role === 'owner'
                  ? t('settings.owner')
                  : t('settings.member')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <HouseholdAddress household={household} locale={locale} />

      {isOwner && (
        <HouseholdEditSheet
          household={household}
          title={t('settings.editHousehold')}
          isOpen={activePanel?.id === household.id && activePanel.mode === 'edit'}
          isSaving={editSaving}
          values={editForm}
          onOpen={onStartEdit}
          onClose={onClosePanel}
          onFieldChange={onSetEditField}
          onSubmit={onEditSave}
          trigger={<Button type="button" className="hidden" aria-hidden tabIndex={-1} />}
          labels={{
            edit: t('common.edit'),
            submit: t('common.save'),
            submitting: t('settings.saving'),
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
      )}

      <HouseholdActionDialog
        open={activePanel?.id === household.id && activePanel.mode === 'invite'}
        onOpenChange={(open) => {
          if (!open) onClosePanel();
        }}
        title={t('settings.invite')}
        description={t('invitations.inviteDescription')}
      >
        <InvitePanel
          householdId={household.id}
          email={inviteEmail}
          role={inviteRole}
          inviting={inviting}
          onSetEmail={onSetInviteEmail}
          onSetRole={onSetInviteRole}
          onSubmit={onInvite}
          onClose={onClosePanel}
          lastCreatedId={lastCreatedInvitationId}
        />
      </HouseholdActionDialog>

      <HouseholdActionDialog
        open={activePanel?.id === household.id && activePanel.mode === 'archive'}
        onOpenChange={(open) => {
          if (!open) onClosePanel();
        }}
        title={t('common.archive')}
        description={t('common.confirmArchive')}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClosePanel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onArchive(household.id)}
            disabled={loading}
          >
            {loading
              ? t('settings.saving')
              : t('common.archive')}
          </Button>
        </div>
      </HouseholdActionDialog>
    </li>
  );
}
