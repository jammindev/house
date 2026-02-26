import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';

interface InteractionListProps {
  title?: string;
  type?: string;
  status?: string;
  limit?: number;
  householdId?: string;
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
  title = 'Latest interactions',
  type,
  status,
  limit = 8,
  householdId,
  emptyMessage = 'No interactions found for this filter.',
  initialItems = [],
  initialCount,
  initialLoaded = false,
  forceReloadOnMount = false,
  syncFiltersWithUrl = true,
}: InteractionListProps) {
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
          setError('Unable to load interactions.');
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

    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
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
      setError('Unable to load more interactions.');
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = items.length < totalCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <label
              htmlFor="interactions-filter-type"
              className="text-xs font-medium text-muted-foreground"
            >
              Type
            </label>
            <select
              id="interactions-filter-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="">All types</option>
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
              Status
            </label>
            <select
              id="interactions-filter-status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            >
              <option value="">All statuses</option>
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
            Reset
          </button>
        </div>

        {loading ? <LoadingState /> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>Loading error</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
                  {loadingMore ? 'Loading…' : 'Voir plus'}
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
