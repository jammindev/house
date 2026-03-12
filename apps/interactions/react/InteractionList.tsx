import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import { FilterBar } from '@/design-system/filter-bar';
import { Skeleton } from '@/design-system/skeleton';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { cn } from '@/lib/utils';

import { MessageSquare } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

interface InteractionListProps {
  title?: string;
  search?: string;
  type?: string;
  status?: string;
  limit?: number;
  emptyMessage?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  highlightedId?: string;
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

function translateInteractionType(t: ReturnType<typeof useTranslation>['t'], value: string): string {
  return t(`interaction_type.${value}`, { defaultValue: value });
}

function translateInteractionStatus(t: ReturnType<typeof useTranslation>['t'], value: string): string {
  return t(`interaction_status.${value}`, { defaultValue: value });
}

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
  search,
  type,
  status,
  limit = 8,
  emptyMessage,
  emptyActionHref,
  emptyActionLabel,
  highlightedId,
  initialItems = [],
  initialCount,
  initialLoaded = false,
  forceReloadOnMount = false,
  syncFiltersWithUrl = true,
}: InteractionListProps) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t('interactions.list_empty');
  const initialSearch = search ?? '';
  const initialType = type ?? '';
  const initialStatus = status ?? '';

  const [selectedSearch, setSelectedSearch] = React.useState(initialSearch);
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
        selectedSearch === initialSearch &&
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
          search: selectedSearch || undefined,
          type: selectedType || undefined,
          status: selectedStatus || undefined,
          limit,
          offset: 0,
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
    selectedSearch,
    selectedType,
    selectedStatus,
    limit,
    initialLoaded,
    forceReloadOnMount,
    initialSearch,
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

    if (selectedSearch) {
      url.searchParams.set('search', selectedSearch);
    } else {
      url.searchParams.delete('search');
    }

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
  }, [selectedSearch, selectedType, selectedStatus, syncFiltersWithUrl]);

  function resetFilters() {
    setSelectedSearch('');
    setSelectedType('');
    setSelectedStatus('');
  }

  async function loadMore() {
    setLoadingMore(true);
    setError(null);

    try {
      const data = await fetchInteractions({
        search: selectedSearch || undefined,
        type: selectedType || undefined,
        status: selectedStatus || undefined,
        limit,
        offset: items.length,
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
  const highlightedItem = highlightedId ? items.find((item) => item.id === highlightedId) : null;

  return (
    <>
      {title ? <PageHeader title={title} /> : null}
    <Card>
      <CardContent className="pt-6">
        {highlightedItem ? (
          <Alert className="mb-4 border-sky-200 bg-sky-50/70 text-sky-950">
            <AlertTitle>{t('interactions.created_notice_title')}</AlertTitle>
            <AlertDescription>
              <p>{t('interactions.created_notice_body', { subject: highlightedItem.subject })}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mb-4">
          <FilterBar
            fields={[
              {
                type: 'search',
                id: 'interactions-filter-search',
                label: t('interactions.search_label'),
                value: selectedSearch,
                onChange: setSelectedSearch,
                placeholder: t('interactions.search_placeholder'),
                className: 'max-w-2xl',
              },
              {
                type: 'select',
                id: 'interactions-filter-type',
                label: t('interactions.filter_type'),
                value: selectedType,
                onChange: setSelectedType,
                options: [
                  { value: '', label: t('interactions.all_types') },
                  ...TYPE_OPTIONS.map((value) => ({ value, label: translateInteractionType(t, value) })),
                ],
              },
              {
                type: 'select',
                id: 'interactions-filter-status',
                label: t('interactions.filter_status'),
                value: selectedStatus,
                onChange: setSelectedStatus,
                options: [
                  { value: '', label: t('interactions.all_statuses') },
                  ...STATUS_OPTIONS.map((value) => ({ value, label: translateInteractionStatus(t, value) })),
                ],
              },
            ]}
            onReset={resetFilters}
            hasActiveFilters={!!(selectedSearch || selectedType || selectedStatus)}
            resetLabel={t('interactions.reset_filters')}
            applyLabel={t('interactions.apply_filters')}
          />
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
          <EmptyState
            icon={MessageSquare}
            title={resolvedEmptyMessage}
            action={emptyActionHref && emptyActionLabel ? { label: emptyActionLabel, href: emptyActionHref } : undefined}
          />
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="space-y-3">
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-md border p-3 transition-colors',
                    item.id === highlightedId ? 'border-sky-300 bg-sky-50/60 ring-1 ring-sky-200' : 'border-border'
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-sm">{item.subject}</p>
                    <div className="flex items-center gap-2">
                      {item.id === highlightedId ? <Badge variant="secondary">{t('interactions.created_badge')}</Badge> : null}
                      <Badge variant="outline">{translateInteractionType(t, item.type)}</Badge>
                      {item.status ? <Badge>{translateInteractionStatus(t, item.status)}</Badge> : null}
                    </div>
                  </div>
                  {item.content ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                  ) : null}
                  {(item.zone_names.length > 0 || item.document_count > 0 || item.project_title) ? (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.zone_names.length > 0 ? (
                        <span>
                          {t('interactions.meta_zones')}: {item.zone_names.join(', ')}
                        </span>
                      ) : null}
                      {item.document_count > 0 ? (
                        <span>
                          {t('interactions.meta_documents', { count: item.document_count })}
                        </span>
                      ) : null}
                      {item.project && item.project_title ? (
                        <a
                          href={`/app/projects/${item.project}/`}
                          className="hover:text-foreground hover:underline"
                        >
                          {item.project_title}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.occurred_at)}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        window.location.assign(`/app/interactions/new/?type=todo&source_interaction_id=${item.id}`);
                      }}
                    >
                      {t('interactions.createTask', { defaultValue: 'Create task' })}
                    </Button>
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
    </>
  );
}

export default InteractionList;
