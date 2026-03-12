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

interface ProjectListProps {
  onNavigate?: (url: string) => void;
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

export default function ProjectList({ onNavigate }: ProjectListProps) {
  const { t } = useTranslation();

  const [groups, setGroups] = React.useState<ProjectGroupItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [items, setItems] = React.useState<ProjectListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pinLoadingId, setPinLoadingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedGroups, loadedItems] = await Promise.all([
        fetchProjectGroups(),
        fetchProjects({ search: search || undefined, status: status || undefined, type: type || undefined, groupId: groupId || undefined }),
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
  }, [search, status, type, groupId, t]);

  React.useEffect(() => {
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
        ? await unpinProject(project.id)
        : await pinProject(project.id);
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
        action: onNavigate
          ? { label: t('projects.new', { defaultValue: 'New project' }), onClick: () => onNavigate('/app/projects/new/') }
          : { label: t('projects.new', { defaultValue: 'New project' }), href: '/app/projects/new/' },
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
            onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate('/app/projects/groups/'); } : undefined}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t('projects.groups', { defaultValue: 'Groups' })}
          </a>
          <a
            href="/app/projects/new/"
            onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate('/app/projects/new/'); } : undefined}
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
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
      </div>
    </ListPage>
  );
}
