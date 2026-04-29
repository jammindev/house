import { useTranslation } from 'react-i18next';
import { Bell, Mail } from 'lucide-react';

import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/settings/hooks';
import { triggerBellRefresh } from '@/lib/notifications';
import type { NotificationItem } from '@/lib/api/notifications';

import { useMarkRead } from './hooks';

interface NotificationCardProps {
  notification: NotificationItem;
}

function formatRelativeFromNow(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHours / 24);
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
  } catch {
    return date.toLocaleDateString();
  }
}

export default function NotificationCard({ notification }: NotificationCardProps) {
  const { t } = useTranslation();
  const markRead = useMarkRead();

  const isInvitation = notification.type === 'household_invitation';
  const Icon = isInvitation ? Mail : Bell;

  const relative = formatRelativeFromNow(notification.created_at);

  function handleMarkRead() {
    if (notification.is_read) return;
    markRead.mutate(notification.id);
  }

  return (
    <Card
      className={`p-3 transition-colors ${notification.is_read ? '' : 'border-primary/40 bg-primary/5'}`}
      onClick={handleMarkRead}
      role={notification.is_read ? undefined : 'button'}
      tabIndex={notification.is_read ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !notification.is_read) {
          e.preventDefault();
          handleMarkRead();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            notification.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{notification.title}</p>
            {!notification.is_read && (
              <span
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-label={t('notifications.unread')}
              />
            )}
          </div>
          {notification.body ? (
            <p className="text-sm text-muted-foreground">{notification.body}</p>
          ) : null}
          <p className="text-xs text-muted-foreground/70">{relative}</p>
          {isInvitation ? <InvitationActions notification={notification} /> : null}
        </div>
      </div>
    </Card>
  );
}

function InvitationActions({ notification }: { notification: NotificationItem }) {
  const { t } = useTranslation();
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();
  const markRead = useMarkRead();

  const invitationId = (notification.payload?.invitation_id as string | undefined) ?? null;

  if (!invitationId) return null;

  const isAccepting = acceptMutation.isPending && acceptMutation.variables?.invitationId === invitationId;
  const isDeclining = declineMutation.isPending && declineMutation.variables === invitationId;
  const isLoading = isAccepting || isDeclining;

  async function handleAccept(shouldSwitch: boolean) {
    if (!invitationId) return;
    const result = await acceptMutation.mutateAsync({ invitationId, switchToHousehold: shouldSwitch });
    if (!notification.is_read) markRead.mutate(notification.id);
    triggerBellRefresh();
    if (result.switched) {
      window.location.reload();
    }
  }

  async function handleDecline() {
    if (!invitationId) return;
    await declineMutation.mutateAsync(invitationId);
    if (!notification.is_read) markRead.mutate(notification.id);
    triggerBellRefresh();
  }

  return (
    <div
      className="flex flex-wrap gap-2 pt-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        size="sm"
        variant="outline"
        disabled={isLoading}
        onClick={() => void handleDecline()}
      >
        {isDeclining ? t('common.saving') : t('invitations.decline')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isLoading}
        onClick={() => void handleAccept(false)}
      >
        {isAccepting ? t('common.saving') : t('invitations.accept')}
      </Button>
      <Button
        size="sm"
        disabled={isLoading}
        onClick={() => void handleAccept(true)}
      >
        {isAccepting ? t('common.saving') : t('invitations.acceptAndSwitch')}
      </Button>
    </div>
  );
}
