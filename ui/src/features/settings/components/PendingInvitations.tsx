import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { triggerBellRefresh } from '@/lib/notifications';
import { usePendingInvitations, useAcceptInvitation, useDeclineInvitation } from '../hooks';
import type { HouseholdInvitation } from '@/lib/api/households';

export function PendingInvitations() {
  const { t } = useTranslation();
  const { data: invitations = [] } = usePendingInvitations();
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  if (invitations.length === 0) return null;

  async function handleAccept(invitation: HouseholdInvitation, shouldSwitch: boolean) {
    const result = await acceptMutation.mutateAsync({ invitationId: invitation.id, switchToHousehold: shouldSwitch });
    triggerBellRefresh();
    if (result.switched) {
      window.location.reload();
    }
  }

  async function handleDecline(invitation: HouseholdInvitation) {
    await declineMutation.mutateAsync(invitation.id);
    triggerBellRefresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t('invitations.title')}</CardTitle>
          <Badge variant="secondary">{invitations.length}</Badge>
        </div>
        <CardDescription>{t('invitations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((inv) => {
          const isAccepting = acceptMutation.isPending && acceptMutation.variables?.invitationId === inv.id;
          const isDeclining = declineMutation.isPending && declineMutation.variables === inv.id;
          const isLoading = isAccepting || isDeclining;

          return (
            <div
              key={inv.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <p className="font-medium leading-none">{inv.household_name}</p>
                {inv.invited_by_name && (
                  <p className="text-sm text-muted-foreground">
                    {t('invitations.invitedBy', { name: inv.invited_by_name })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => void handleDecline(inv)}
                >
                  {isDeclining ? t('common.saving') : t('invitations.decline')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => void handleAccept(inv, false)}
                >
                  {isAccepting ? t('common.saving') : t('invitations.accept')}
                </Button>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => void handleAccept(inv, true)}
                >
                  {isAccepting ? t('common.saving') : t('invitations.acceptAndSwitch')}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
