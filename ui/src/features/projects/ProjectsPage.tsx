import * as React from 'react';
import { FolderOpen, FolderKanban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { FilterBar } from '@/design-system/filter-bar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import type { ProjectListItem, ProjectGroupItem } from '@/lib/api/projects';
import {
  useProjects,
  useProjectGroups,
  useDeleteProject,
  useDeleteGroup,
  projectKeys,
} from './hooks';
import ProjectCard from './ProjectCard';
import ProjectDialog from './ProjectDialog';
import GroupCard from './GroupCard';
import GroupDialog from './GroupDialog';

type TabKey = 'projects' | 'groups';

const STATUS_OPTIONS = ['', 'draft', 'active', 'on_hold', 'completed', 'cancelled'];
const TYPE_OPTIONS = [
  '', 'renovation', 'maintenance', 'repair', 'purchase',
  'relocation', 'vacation', 'leisure', 'other',
];

export default function ProjectsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = React.useState<TabKey>('projects');

  // Project filters
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');

  // Project dialog
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectListItem | null>(null);

  // Group dialog
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<ProjectGroupItem | null>(null);
  const [deletingGroupId, setDeletingGroupId] = React.useState<string | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    }),
    [search, status, type],
  );

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects(filters);
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useProjectGroups();
  const deleteProjectMutation = useDeleteProject();
  const deleteGroupMutation = useDeleteGroup();

  // Sort projects: pinned first
  const sortedProjects = React.useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.is_pinned === b.is_pinned) return 0;
        return a.is_pinned ? -1 : 1;
      }),
    [projects],
  );

  const handleProjectSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: projectKeys.all });
  }, [qc]);

  const handleGroupSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: projectKeys.groups() });
  }, [qc]);

  // Delete project with undo
  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('projects.deleted'),
    onDelete: (id) => deleteProjectMutation.mutateAsync(id),
  });

  const handleDeleteProject = React.useCallback(
    (projectId: string) => {
      const project = sortedProjects.find((p) => p.id === projectId);
      if (!project) return;
      deleteWithUndo(projectId, {
        onRemove: () =>
          qc.setQueryData<ProjectListItem[]>(projectKeys.list(filters), (old) =>
            old?.filter((p) => p.id !== projectId),
          ),
        onRestore: () =>
          qc.setQueryData<ProjectListItem[]>(projectKeys.list(filters), (old) =>
            old ? [...old, project] : [project],
          ),
      });
    },
    [sortedProjects, deleteWithUndo, qc, filters],
  );

  // Delete group with confirm dialog
  const handleConfirmDeleteGroup = React.useCallback(() => {
    if (!deletingGroupId) return;
    deleteGroupMutation.mutate(deletingGroupId, {
      onSuccess: () => setDeletingGroupId(null),
      onError: () => setDeletingGroupId(null),
    });
  }, [deletingGroupId, deleteGroupMutation]);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setType('');
  }

  const hasActiveFilters = !!(search || status || type);
  const isProjectsEmpty = !projectsLoading && !projectsError && sortedProjects.length === 0;
  const isGroupsEmpty = !groupsLoading && !groupsError && groups.length === 0;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'projects', label: t('projects.title') },
    { key: 'groups', label: t('projects.groups.title') },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Projects tab */}
      {activeTab === 'projects' ? (
        <>
          <ListPage
            title={t('projects.title')}
            isEmpty={isProjectsEmpty}
            emptyState={
              hasActiveFilters
                ? {
                    icon: FolderOpen,
                    title: t('projects.no_filter_results'),
                  }
                : {
                    icon: FolderOpen,
                    title: t('projects.empty_list'),
                    description: t('projects.empty_description'),
                    action: { label: t('projects.new'), onClick: () => setProjectDialogOpen(true) },
                  }
            }
            actions={
              <button
                type="button"
                onClick={() => setProjectDialogOpen(true)}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t('projects.new')}
              </button>
            }
          >
            <div className="space-y-4">
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
                ]}
                onReset={resetFilters}
                hasActiveFilters={hasActiveFilters}
                resetLabel={t('projects.reset')}
                applyLabel={t('projects.apply')}
              />

              {projectsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {t('projects.error_loading_list')}
                  <button
                    type="button"
                    onClick={() => qc.invalidateQueries({ queryKey: projectKeys.all })}
                    className="ml-2 underline hover:no-underline"
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : null}

              {projectsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : null}

              {!projectsLoading && !projectsError ? (
                <div className="space-y-3">
                  {sortedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onEdit={setEditingProject}
                      onDelete={handleDeleteProject}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </ListPage>

          <ProjectDialog
            open={projectDialogOpen}
            onOpenChange={setProjectDialogOpen}
            onSaved={handleProjectSaved}
          />

          <ProjectDialog
            open={editingProject !== null}
            onOpenChange={(open) => {
              if (!open) setEditingProject(null);
            }}
            existingProject={editingProject ?? undefined}
            onSaved={handleProjectSaved}
          />
        </>
      ) : null}

      {/* Groups tab */}
      {activeTab === 'groups' ? (
        <>
          <ListPage
            title={t('projects.groups.title')}
            isEmpty={isGroupsEmpty}
            emptyState={{
              icon: FolderKanban,
              title: t('projects.groups.empty'),
              description: t('projects.groups.empty_description'),
              action: { label: t('projects.groups.new'), onClick: () => setGroupDialogOpen(true) },
            }}
            actions={
              <button
                type="button"
                onClick={() => setGroupDialogOpen(true)}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t('projects.groups.new')}
              </button>
            }
          >
            <div className="space-y-2">
              {groupsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {t('projects.groups.error_loading')}
                  <button
                    type="button"
                    onClick={() => qc.invalidateQueries({ queryKey: projectKeys.groups() })}
                    className="ml-2 underline hover:no-underline"
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : null}

              {groupsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : null}

              {!groupsLoading && !groupsError ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onEdit={setEditingGroup}
                      onDelete={setDeletingGroupId}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </ListPage>

          <GroupDialog
            open={groupDialogOpen}
            onOpenChange={setGroupDialogOpen}
            onSaved={handleGroupSaved}
          />

          <GroupDialog
            open={editingGroup !== null}
            onOpenChange={(open) => {
              if (!open) setEditingGroup(null);
            }}
            existingGroup={editingGroup ?? undefined}
            onSaved={handleGroupSaved}
          />

          <ConfirmDialog
            open={deletingGroupId !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingGroupId(null);
            }}
            title={t('common.confirmDelete')}
            description={t('projects.groups.delete_confirm', {
              name: groups.find((g) => g.id === deletingGroupId)?.name ?? '',
            })}
            onConfirm={handleConfirmDeleteGroup}
            loading={deleteGroupMutation.isPending}
          />
        </>
      ) : null}
    </>
  );
}
