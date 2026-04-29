import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';

import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';

import NotificationCard from './NotificationCard';
import { useMarkAllRead, useNotifications, useUnreadCount } from './hooks';

type FilterKey = 'all' | 'unread';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllRead = useMarkAllRead();
  const [filter, setFilter] = useSessionState<FilterKey>('notifications.filter', 'all');

  const showSkeleton = useDelayedLoading(isLoading);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const hasUnread = unreadCount > 0;

  return (
    <div>
      <PageHeader title={t('notifications.title')} description={t('notifications.description')}>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasUnread || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {t('notifications.markAllRead')}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5 pb-4">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('notifications.filters.all')}
          <span className="ml-1 text-[10px] opacity-70">({notifications.length})</span>
        </FilterPill>
        <FilterPill active={filter === 'unread'} onClick={() => setFilter('unread')}>
          {t('notifications.filters.unread')}
          <span className="ml-1 text-[10px] opacity-70">({unreadCount})</span>
        </FilterPill>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')}
          description={t('notifications.emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
