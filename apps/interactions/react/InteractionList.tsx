import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Skeleton } from '@/design-system/skeleton';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface InteractionListProps {
  title?: string;
  type?: string;
  status?: string;
  limit?: number;
  emptyMessage?: string;
  initialItems?: InteractionListItem[];
  initialCount?: number;
  initialLoaded?: boolean;
  forceReloadOnMount?: boolean;
  syncFiltersWithUrl?: boolean;
}

const TYPE_OPTIONS = [
  'note',
  'todo',
  'expense',
  'maintenance',
  'repair',
  'installation',
  'inspection',
  'warranty',
  'issue',
  'upgrade',
  'replacement',
  'disposal',
];

const STATUS_OPTIONS = ['backlog', 'pending', 'in_progress', 'done', 'archived'];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-4/5" />
    </div>
  );
}

export function InteractionList({
  title,
  type,
  status,
  limit = 8,
  emptyMessage,
  initialItems = [],
  initialCount,
  initialLoaded = false,
  forceReloadOnMount = false,
  syncFiltersWithUrl = true,
}: InteractionListProps) {
  const { t } = useTranslation();
  const householdId = useHouseholdId();
  const resolvedTitle = title ?? t('interactions.list_title');
  const resolvedEmptyMessage = emptyMessage ?? t('interactions.list_empty');
  const initialType = type ?? '';
  const initialStatus = status ?? '';

  const [selectedType, setSelectedType] = React.useState(initialType);
  const [selectedStatus, setSelectedStatus] = React.useState(initialStatus);
  const [items, setItems] = React.useState<InteractionListItem[]>(initialItems);
  const [totalCount, setTotalCount] = React.useState<number>(initialCount ?? initialItems.length);
  const [loading, setLoading] = React.useState(!initialLoaded || forceReloadOnMount);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasAppliedServerInitialData = React.useRef(false);

  React.useEffect(() => {
    if (!hasAppliedServerInitialData.current) {
      const shouldUseInitialData =
        initialLoaded &&
        !forceReloadOnMount &&
        selectedType === initialType &&
        selectedStatus === initialStatus;

      if (shouldUseInitialData) {
        hasAppliedServerInitialData.current = true;
        setLoading(false);
        setError(null);
        setTotalCount(initialCount ?? initialItems.length);
        return;
      }

      hasAppliedServerInitialData.current = true;
    }

    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchInteractions({
          type: selectedType || undefined,
          status: selectedStatus || undefined,
          limit,
          offset: 0,
          householdId,
        });

        if (isMounted) {
          setItems(data.items);
          setTotalCount(data.count);
        }
      } catch {
        if (isMounted) {
          setError(t('interactions.error_load_failed'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [
    selectedType,
    selectedStatus,
    limit,
    householdId,
    initialLoaded,
    forceReloadOnMount,
    initialType,
    initialStatus,
    initialItems,
    initialCount,
  ]);

  React.useEffect(() => {
    if (!syncFiltersWithUrl || typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (selectedType) {
      url.searchParams.set('type', selectedType);
    } else {
      url.searchParams.delete('type');
    }

    if (selectedStatus) {
      url.searchParams.set('status', selectedStatus);
    } else {
      url.searchParams.delete('status');
    }

    const qs = url.searchParams.toString();
    window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname);
  }, [selectedType, selectedStatus, syncFiltersWithUrl]);

  function resetFilters() {
    setSelectedType('');
    setSelectedStatus('');
  }

  async function loadMore() {
    setLoadingMore(true);
    setError(null);

    try {
      const data = await fetchInteractions({
        type: selectedType || undefined,
        status: selectedStatus || undefined,
        limit,
        offset: items.length,
        householdId,
      });

      const knownIds = new Set(items.map((item) => item.id));
      const appended = data.items.filter((item) => !knownIds.has(item.id));

      setItems((previous) => [...previous, ...appended]);
      setTotalCount(data.count);
    } catch {
      setError(t('interactions.error_load_more_failed'));
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = items.length < totalCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{resolvedTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <label
              htmlFor="interactions-filter-type"
              className="text-xs font-medium text-muted-foreground"
            >
              {t('interactions.filter_type')}
            </label>
            <select
              id="interactions-filter-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="">{t('interactions.all_types')}</option>
              {TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="interactions-filter-status"
              className="text-xs font-medium text-muted-foreground"
            >
              {t('interactions.filter_status')}
            </label>
            <select
              id="interactions-filter-status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            >
              <option value="">{t('interactions.all_statuses')}</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-3 text-sm"
            onClick={resetFilters}
            disabled={!selectedType && !selectedStatus}
          >
            {t('interactions.reset_filters')}
          </button>
        </div>

        {loading ? <LoadingState /> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>{t('interactions.loading_error_title')}</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{resolvedEmptyMessage}</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="space-y-3">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-sm">{item.subject}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      {item.status ? <Badge>{item.status}</Badge> : null}
                    </div>
                  </div>
                  {item.content ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.occurred_at)}
                  </div>
                </li>
              ))}
            </ul>

            {hasMore ? (
              <div className="flex items-center justify-center">
                <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('interactions.loading_more') : t('interactions.load_more')}
                </Button>
              </div>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              {items.length} / {totalCount}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default InteractionList;
