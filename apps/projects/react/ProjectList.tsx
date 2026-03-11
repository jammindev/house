import * as React from 'react';
import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { FilterBar } from '@/design-system/filter-bar';
import ListPage from '@/components/ListPage';
import {
  fetchProjects,
  fetchProjectGroups,
  pinProject,
  unpinProject,
  type ProjectListItem,
  type ProjectGroupItem,
} from '@/lib/api/projects';
import ProjectCard from './ProjectCard';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface ProjectListProps {
  initialSearch?: string;
  initialStatus?: string;
  initialType?: string;
  initialGroupId?: string;
  initialItems?: ProjectListItem[];
  initialGroups?: ProjectGroupItem[];
}

const STATUS_OPTIONS = ['', 'draft', 'active', 'on_hold', 'completed', 'cancelled'];
const TYPE_OPTIONS = [
  '',
  'renovation',
  'maintenance',
  'repair',
  'purchase',
  'relocation',
  'vacation',
  'leisure',
  'other',
];

export default function ProjectList({
  initialSearch = '',
  initialStatus = '',
  initialType = '',
  initialGroupId = '',
  initialItems,
  initialGroups,
}: ProjectListProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();

  const hasServerData = initialItems !== undefined && initialGroups !== undefined;

  const [groups, setGroups] = React.useState<ProjectGroupItem[]>(initialGroups ?? []);
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus);
  const [type, setType] = React.useState(initialType);
  const [groupId, setGroupId] = React.useState(initialGroupId);
  const [items, setItems] = React.useState<ProjectListItem[]>(initialItems ?? []);
  const [loading, setLoading] = React.useState(!hasServerData);
  const [error, setError] = React.useState<string | null>(null);
  const [pinLoadingId, setPinLoadingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedGroups, loadedItems] = await Promise.all([
        fetchProjectGroups(householdId),
        fetchProjects({ householdId, search: search || undefined, status: status || undefined, type: type || undefined, groupId: groupId || undefined }),
      ]);
      setGroups(loadedGroups);
      // Sort: pinned first, then by updated_at desc
      const sorted = [...loadedItems].sort((a, b) => {
        if (a.is_pinned === b.is_pinned) return 0;
        return a.is_pinned ? -1 : 1;
      });
      setItems(sorted);
    } catch {
      setError(t('projects.error_loading_list'));
    } finally {
      setLoading(false);
    }
  }, [householdId, search, status, type, groupId, t]);

  // Skip the initial fetch when Django already provided server-side data.
  // Re-fetch whenever the user changes a filter.
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current && hasServerData) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL params
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const setOrDelete = (key: string, value: string) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    setOrDelete('search', search);
    setOrDelete('status', status);
    setOrDelete('type', type);
    setOrDelete('group', groupId);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname);
  }, [search, status, type, groupId]);

  async function handleTogglePin(project: ProjectListItem) {
    setPinLoadingId(project.id);
    try {
      const updated = project.is_pinned
        ? await unpinProject(project.id, householdId)
        : await pinProject(project.id, householdId);
      setItems((prev) => {
        const next = prev.map((p) => (p.id === project.id ? updated : p));
        return [...next].sort((a, b) => {
          if (a.is_pinned === b.is_pinned) return 0;
          return a.is_pinned ? -1 : 1;
        });
      });
    } finally {
      setPinLoadingId(null);
    }
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setType('');
    setGroupId('');
  }

  const hasActiveFilters = !!(search || status || type || groupId);
  const isEmpty = !loading && !error && items.length === 0;
  const emptyState = hasActiveFilters
    ? {
        icon: FolderOpen,
        title: t('projects.no_filter_results', { defaultValue: 'No projects match your filters.' }),
      }
    : {
        icon: FolderOpen,
        title: t('projects.empty_list'),
        description: t('projects.description', { defaultValue: 'Manage your renovation, maintenance and other projects.' }),
        action: { label: t('projects.new', { defaultValue: 'New project' }), href: '/app/projects/new/' },
      };

  return (
    <ListPage
      title={t('projects.title', { defaultValue: 'Projects' })}
      description={t('projects.description', { defaultValue: 'Manage your renovation, maintenance and other projects.' })}
      isEmpty={isEmpty}
      emptyState={emptyState}
      actions={
        <>
          <a
            href="/app/projects/groups/"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t('projects.groups', { defaultValue: 'Groups' })}
          </a>
          <a
            href="/app/projects/new/"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('projects.new', { defaultValue: 'New project' })}
          </a>
        </>
      }
    >
      <div className="space-y-4">
      {/* Filters */}
      <FilterBar
        fields={[
          {
            type: 'search',
            id: 'proj-search',
            label: t('projects.search'),
            value: search,
            onChange: setSearch,
            placeholder: t('projects.search_placeholder'),
          },
          {
            type: 'select',
            id: 'proj-status',
            label: t('projects.status_label'),
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS.map((s) => ({
              value: s,
              label: s ? t(`projects.status.${s}`) : t('projects.all_statuses'),
            })),
          },
          {
            type: 'select',
            id: 'proj-type',
            label: t('projects.type_label'),
            value: type,
            onChange: setType,
            options: TYPE_OPTIONS.map((tp) => ({
              value: tp,
              label: tp ? t(`projects.type.${tp}`) : t('projects.all_types'),
            })),
          },
          {
            type: 'select',
            id: 'proj-group',
            label: t('projects.group_label'),
            value: groupId,
            onChange: setGroupId,
            options: [
              { value: '', label: t('projects.all_groups') },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ],
          },
        ]}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        resetLabel={t('projects.reset')}
        applyLabel={t('projects.apply')}
      />

      {/* States */}
      {loading ? <p className="text-sm text-muted-foreground">{t('projects.loading')}</p> : null}

      {!loading && error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* List */}
      {!loading && !error && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              detailUrl={`/app/projects/${project.id}/`}
              onTogglePin={handleTogglePin}
              pinLoading={pinLoadingId === project.id}
            />
          ))}
        </div>
      ) : null}
      </div>
    </ListPage>
  );
}
