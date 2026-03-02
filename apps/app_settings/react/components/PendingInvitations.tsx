import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import type { HouseholdInvitation } from '@/lib/api/households';
import { acceptInvitation, declineInvitation } from '@/lib/api/households';
import { useToast } from '@/lib/toast';

interface PendingInvitationsProps {
  initialInvitations: HouseholdInvitation[];
  /** Called after accept so other parts of the page can refresh households list */
  onAccepted?: (householdId: string, switched: boolean) => void;
}

type ActionState = 'idle' | 'accepting' | 'accepting-switch' | 'declining';

export function PendingInvitations({ initialInvitations, onAccepted }: PendingInvitationsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [invitations, setInvitations] = React.useState<HouseholdInvitation[]>(initialInvitations);
  const [busy, setBusy] = React.useState<Record<string, ActionState>>({});

  if (invitations.length === 0) return null;

  async function handleAccept(invitation: HouseholdInvitation, shouldSwitch: boolean) {
    setBusy((prev) => ({
      ...prev,
      [invitation.id]: shouldSwitch ? 'accepting-switch' : 'accepting',
    }));
    try {
      const result = await acceptInvitation(invitation.id, shouldSwitch);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      toast({
        description: t('invitations.accepted', {
          name: invitation.household_name,
          defaultValue: `Joined {{name}}.`,
        }),
        variant: 'success',
      });
      onAccepted?.(result.household_id, result.switched);
      if (result.switched) {
        // Reload the page so the active household switches properly
        window.location.reload();
      }
    } catch {
      toast({
        description: t('settings.requestFailed', { defaultValue: 'Action failed.' }),
        variant: 'destructive',
      });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[invitation.id];
        return next;
      });
    }
  }

  async function handleDecline(invitation: HouseholdInvitation) {
    setBusy((prev) => ({ ...prev, [invitation.id]: 'declining' }));
    try {
      await declineInvitation(invitation.id);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      toast({
        description: t('invitations.declined', {
          name: invitation.household_name,
          defaultValue: `Invitation to {{name}} declined.`,
        }),
        variant: 'default',
      });
    } catch {
      toast({
        description: t('settings.requestFailed', { defaultValue: 'Action failed.' }),
        variant: 'destructive',
      });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[invitation.id];
        return next;
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>
            {t('invitations.title', { defaultValue: 'Pending invitations' })}
          </CardTitle>
          <Badge variant="secondary">{invitations.length}</Badge>
        </div>
        <CardDescription>
          {t('invitations.description', {
            defaultValue: 'You have been invited to join the following households.',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((inv) => {
          const state = busy[inv.id] ?? 'idle';
          const isLoading = state !== 'idle';
          return (
            <div
              key={inv.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <p className="font-medium leading-none">{inv.household_name}</p>
                {inv.invited_by_name && (
                  <p className="text-sm text-muted-foreground">
                    {t('invitations.invitedBy', {
                      name: inv.invited_by_name,
                      defaultValue: 'Invited by {{name}}',
                    })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => handleDecline(inv)}
                >
                  {state === 'declining'
                    ? t('common.loading', { defaultValue: '…' })
                    : t('invitations.decline', { defaultValue: 'Decline' })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => handleAccept(inv, false)}
                >
                  {state === 'accepting'
                    ? t('common.loading', { defaultValue: '…' })
                    : t('invitations.accept', { defaultValue: 'Accept' })}
                </Button>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleAccept(inv, true)}
                >
                  {state === 'accepting-switch'
                    ? t('common.loading', { defaultValue: '…' })
                    : t('invitations.acceptAndSwitch', { defaultValue: 'Accept & join' })}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
