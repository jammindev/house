import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/settings/hooks';
import { Button } from '@/design-system/button';
import { triggerBellRefresh } from '@/lib/notifications';
import type { NotificationItem } from '@/lib/api/notifications';

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from './hooks';

const MAX_PREVIEW = 5;

function relativeShort(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.round((date.getTime() - Date.now()) / 60_000);
  const diffHours = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHours / 24);
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
  } catch {
    return date.toLocaleDateString();
  }
}

export default function NotificationsBell() {
  const { t } = useTranslation();
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllRead = useMarkAllRead();

  const preview = notifications.slice(0, MAX_PREVIEW);
  const hasUnread = unreadCount > 0;
  const ariaLabel = hasUnread
    ? t('notifications.bellAriaLabelUnread', { count: unreadCount })
    : t('notifications.bellAriaLabel');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={ariaLabel}
          data-testid="notifications-bell"
        >
          <Bell className="h-5 w-5" />
          {hasUnread ? (
            <span
              className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
              data-testid="notifications-bell-badge"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" data-testid="notifications-dropdown">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="px-0 py-0 text-sm">{t('notifications.title')}</DropdownMenuLabel>
          {hasUnread ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {preview.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('notifications.empty')}
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {preview.map((n) => (
              <li key={n.id}>
                <NotificationDropdownItem notification={n} />
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator className="my-0" />
        <div className="px-1 py-1">
          <Link
            to="/app/notifications"
            className="block w-full rounded-md px-2 py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/10"
          >
            {t('notifications.viewAll')}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationDropdownItem({ notification }: { notification: NotificationItem }) {
  const { t } = useTranslation();
  const markRead = useMarkRead();
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const isInvitation = notification.type === 'household_invitation';
  const invitationId = (notification.payload?.invitation_id as string | undefined) ?? null;

  const isAccepting = acceptMutation.isPending && acceptMutation.variables?.invitationId === invitationId;
  const isDeclining = declineMutation.isPending && declineMutation.variables === invitationId;
  const isLoading = isAccepting || isDeclining;

  function handleClick() {
    if (!notification.is_read) markRead.mutate(notification.id);
  }

  async function handleAccept() {
    if (!invitationId) return;
    const result = await acceptMutation.mutateAsync({ invitationId, switchToHousehold: false });
    if (!notification.is_read) markRead.mutate(notification.id);
    triggerBellRefresh();
    if (result.switched) window.location.reload();
  }

  async function handleDecline() {
    if (!invitationId) return;
    await declineMutation.mutateAsync(invitationId);
    if (!notification.is_read) markRead.mutate(notification.id);
    triggerBellRefresh();
  }

  return (
    <div
      className={`flex flex-col gap-1 px-3 py-2 text-sm transition-colors hover:bg-accent ${
        notification.is_read ? '' : 'bg-primary/5'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight text-foreground">{notification.title}</p>
        {!notification.is_read && (
          <span
            className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
            aria-label={t('notifications.unread')}
          />
        )}
      </div>
      {notification.body ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
      ) : null}
      <p className="text-[10px] text-muted-foreground/70">{relativeShort(notification.created_at)}</p>
      {isInvitation && invitationId ? (
        <div
          className="flex flex-wrap gap-1.5 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => void handleDecline()}
          >
            {isDeclining ? t('common.saving') : t('invitations.decline')}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => void handleAccept()}
          >
            {isAccepting ? t('common.saving') : t('invitations.accept')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
