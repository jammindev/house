import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
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
  householdId?: string | null;
  initialSearch?: string;
  initialStatus?: string;
  initialType?: string;
  initialGroupId?: string;
  newUrl?: string;
  groupsUrl?: string;
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
  householdId,
  initialSearch = '',
  initialStatus = '',
  initialType = '',
  initialGroupId = '',
  newUrl = '/app/projects/new/',
  groupsUrl = '/app/projects/groups/',
}: ProjectListProps) {
  const { t } = useTranslation();

  const [groups, setGroups] = React.useState<ProjectGroupItem[]>([]);
  const [searchDraft, setSearchDraft] = React.useState(initialSearch);
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus);
  const [type, setType] = React.useState(initialType);
  const [groupId, setGroupId] = React.useState(initialGroupId);
  const [items, setItems] = React.useState<ProjectListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
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

  React.useEffect(() => {
    load();
  }, [load]);

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
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
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
    setSearchDraft('');
    setSearch('');
    setStatus('');
    setType('');
    setGroupId('');
  }

  const hasActiveFilters = !!(search || status || type || groupId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{t('projects.title')}</CardTitle>
          <div className="flex gap-2">
            <a href={groupsUrl} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              {t('projects.groups')}
            </a>
            <a href={newUrl} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              {t('projects.new')}
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto] md:items-end">
          <div className="space-y-1">
            <label htmlFor="proj-search" className="text-xs font-medium text-muted-foreground">
              {t('projects.search')}
            </label>
            <div className="flex gap-2">
              <Input
                id="proj-search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchDraft.trim())}
                placeholder={t('projects.search_placeholder')}
              />
              <Button type="button" variant="outline" onClick={() => setSearch(searchDraft.trim())}>
                {t('projects.apply')}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="proj-status" className="text-xs font-medium text-muted-foreground">
              {t('projects.status_label')}
            </label>
            <Select id="proj-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s ? t(`projects.status.${s}`) : t('projects.all_statuses')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="proj-type" className="text-xs font-medium text-muted-foreground">
              {t('projects.type_label')}
            </label>
            <Select id="proj-type" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((tp) => (
                <option key={tp || 'all'} value={tp}>
                  {tp ? t(`projects.type.${tp}`) : t('projects.all_types')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="proj-group" className="text-xs font-medium text-muted-foreground">
              {t('projects.group_label')}
            </label>
            <Select id="proj-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{t('projects.all_groups')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>

          <Button type="button" variant="outline" onClick={resetFilters} disabled={!hasActiveFilters}>
            {t('projects.reset')}
          </Button>
        </div>

        {/* States */}
        {loading ? <p className="text-sm text-muted-foreground">{t('projects.loading')}</p> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('projects.empty_list')}</p>
        ) : null}

        {/* Grid */}
        {!loading && !error && items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
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
      </CardContent>
    </Card>
  );
}
