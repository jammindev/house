import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Plus } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import { TabShell } from '@/components/TabShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ProjectStatus } from '@/lib/api/projects';
import TasksPanel from '@/features/tasks/TasksPanel';
import NewTaskDialog from '@/features/tasks/NewTaskDialog';
import { taskKeys, useHouseholdMembersWithMe } from '@/features/tasks/hooks';
import {
  useProject,
  useProjectInteractions,
  useDeleteProject,
  usePinProject,
  projectKeys,
} from './hooks';
import ProjectDialog from './ProjectDialog';
import ProjectDocumentsTab from './ProjectDocumentsTab';
import ProjectPurchaseDialog from './ProjectPurchaseDialog';
import ProjectDashboard from './ProjectDashboard';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

// ── Helpers ────────────────────────────────────────────────

type Tab = 'overview' | 'tasks' | 'notes' | 'expenses' | 'documents' | 'timeline';
const TABS: Tab[] = ['overview', 'tasks', 'notes', 'expenses', 'documents', 'timeline'];

function statusVariant(status: ProjectStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'on_hold') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

// ── Tab: interactions list ─────────────────────────────────

function TabInteractions({
  projectId,
  type,
  emptyKey,
  addUrl,
  addLabel,
}: {
  projectId: string;
  type?: string;
  emptyKey: string;
  addUrl?: string;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const { data: items = [], isLoading, error } = useProjectInteractions(projectId, type);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">{t('common.error_loading')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {addUrl ? (
        <div className="flex justify-end">
          <Link
            to={addUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Link>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t(emptyKey)}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{item.subject || '—'}</span>
                <div className="flex shrink-0 gap-1">
                  {item.type ? (
                    <Badge variant="outline" className="h-5 text-[10px]">
                      {t(`interactions.type.${item.type}`, { defaultValue: item.type })}
                    </Badge>
                  ) : null}
                  {item.status ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      {t(`interactions.status.${item.status}`, { defaultValue: item.status })}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {item.content ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
              ) : null}
              {item.occurred_at ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(item.occurred_at)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);

  const { data: project, isLoading, error } = useProject(id ?? '');
  const { data: householdMembers = [] } = useHouseholdMembersWithMe();
  const deleteProjectMutation = useDeleteProject();
  const pinProjectMutation = usePinProject();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: projectKeys.all });
  }, [qc]);

  const handleTaskCreated = React.useCallback(() => {
    if (!id) return;
    void qc.invalidateQueries({ queryKey: taskKeys.project(id) });
    void qc.invalidateQueries({ queryKey: taskKeys.all });
  }, [qc, id]);

  const showSkeleton = useDelayedLoading(isLoading);

  function handleDelete() {
    if (!id) return;
    deleteProjectMutation.mutate(id, {
      onSuccess: () => navigate('/app/projects'),
    });
  }

  if (showSkeleton) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (isLoading) return null;

  if (error || !project) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {t('projects.detail.error_loading')}
      </div>
    );
  }

  const planned = Number(project.planned_budget);
  const actual = Number(project.actual_cost_cached);
  const overBudget = actual > planned && planned > 0;

  return (
    <>
      <div className="space-y-4">
        {/* Back */}
        <Link
          to="/app/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('projects.title')}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
              <Badge variant={statusVariant(project.status)} className="text-xs">
                {t(`projects.status.${project.status}`)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {t(`projects.type.${project.type}`)}
              </Badge>
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                P{project.priority}
              </span>
              {project.project_group_name ? (
                <span className="text-xs text-muted-foreground">
                  {project.project_group_name}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                pinProjectMutation.mutate({ id: project.id, pinned: project.is_pinned })
              }
              disabled={pinProjectMutation.isPending}
              aria-label={project.is_pinned ? t('projects.unpin') : t('projects.pin')}
            >
              <Star
                className="h-4 w-4"
                fill={project.is_pinned ? 'currentColor' : 'none'}
              />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 px-3 text-sm"
              onClick={() => setPurchaseOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('projects.purchase.actions.add')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setEditOpen(true)}
            >
              {t('projects.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-8 px-3 text-sm"
              onClick={() => setDeleteOpen(true)}
            >
              {t('projects.delete')}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        {(planned > 0 || actual > 0) ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            {planned > 0 ? (
              <span>
                {t('projects.summary.budget', { defaultValue: 'Budget' })}{' '}
                <span className={`font-medium ${overBudget ? 'text-destructive' : ''}`}>
                  {actual > 0 ? `${actual.toFixed(0)} €` : '0 €'}
                </span>
                {' / '}{planned.toFixed(0)} €{' '}
                <span className="text-xs text-muted-foreground">
                  ({((actual / planned) * 100).toFixed(0)} %)
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Tabs */}
        <TabShell
          tabs={TABS.map((tab) => ({ key: tab, label: t(`projects.tabs.${tab}`) }))}
          sessionKey={`project-detail.${project.id}.tab`}
          defaultTab="overview"
        >
          {(tab) => (
            <Card>
              <CardContent className="pt-4">
                {tab === 'overview' ? (
                  <ProjectDashboard
                    project={project}
                    onAddTask={() => setNewTaskOpen(true)}
                  />
                ) : null}

                {tab === 'tasks' ? (
                  <TasksPanel
                    projectId={project.id}
                    stateKeyPrefix={`project.${project.id}`}
                  />
                ) : null}

                {tab === 'notes' ? (
                  <TabInteractions
                    projectId={project.id}
                    type="note"
                    emptyKey="projects.empty_notes"
                    addUrl={`/app/interactions/new?type=note&project_id=${project.id}`}
                    addLabel={t('projects.add_note')}
                  />
                ) : null}

                {tab === 'expenses' ? (
                  <TabInteractions
                    projectId={project.id}
                    type="expense"
                    emptyKey="projects.empty_expenses"
                  />
                ) : null}

                {tab === 'documents' ? (
                  <ProjectDocumentsTab projectId={project.id} />
                ) : null}

                {tab === 'timeline' ? (
                  <TabInteractions
                    projectId={project.id}
                    emptyKey="projects.empty_timeline"
                    addUrl={`/app/interactions/new?project_id=${project.id}`}
                    addLabel={t('projects.add_activity')}
                  />
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabShell>
      </div>

      <ProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingProject={project}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('projects.delete_confirm', { title: project.title })}
        onConfirm={handleDelete}
        loading={deleteProjectMutation.isPending}
      />

      <ProjectPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        project={project}
      />

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={handleTaskCreated}
        householdMembers={householdMembers}
        defaultProjectId={project.id}
      />
    </>
  );
}
