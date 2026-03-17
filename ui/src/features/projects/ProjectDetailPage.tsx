import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Star } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ProjectStatus } from '@/lib/api/projects';
import {
  useProject,
  useProjectInteractions,
  useDeleteProject,
  usePinProject,
  projectKeys,
} from './hooks';
import ProjectDialog from './ProjectDialog';

// ── Helpers ────────────────────────────────────────────────

type Tab = 'description' | 'tasks' | 'notes' | 'expenses' | 'documents' | 'timeline' | 'metrics';
const TABS: Tab[] = ['description', 'tasks', 'notes', 'expenses', 'documents', 'timeline', 'metrics'];

function statusVariant(status: ProjectStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'on_hold') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
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
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
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

// ── Tab: metrics ───────────────────────────────────────────

function MetricsTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: project } = useProject(projectId);
  if (!project) return null;

  const planned = Number(project.planned_budget);
  const actual = Number(project.actual_cost_cached);
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const overBudget = actual > planned && planned > 0;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t('projects.metrics.planned_budget')}</p>
          <p className="mt-1 text-xl font-semibold">{planned > 0 ? `${planned.toFixed(2)} €` : '—'}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t('projects.metrics.actual_cost')}</p>
          <p className={`mt-1 text-xl font-semibold ${overBudget ? 'text-destructive' : ''}`}>
            {actual > 0 ? `${actual.toFixed(2)} €` : '—'}
          </p>
        </div>
      </div>

      {planned > 0 ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t('projects.metrics.budget_used', { pct: pct.toFixed(0) })}</span>
            {overBudget ? (
              <span className="text-destructive">{t('projects.metrics.over_budget')}</span>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {t('projects.start_date')}: {formatDate(project.start_date)}
        </p>
        <p>
          {t('projects.due_date')}: {formatDate(project.due_date)}
        </p>
        {project.closed_at ? (
          <p>
            {t('projects.closed_at')}: {formatDateTime(project.closed_at)}
          </p>
        ) : null}
      </div>

      {project.zones.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t('projects.zones')}</p>
          <div className="flex flex-wrap gap-1">
            {project.zones.map((z) => (
              <span
                key={z.id}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                style={z.color ? { borderColor: z.color, color: z.color } : {}}
              >
                {z.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {project.tags.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t('projects.tags')}</p>
          <div className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = React.useState<Tab>('description');
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: project, isLoading, error } = useProject(id ?? '');
  const deleteProjectMutation = useDeleteProject();
  const pinProjectMutation = usePinProject();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: projectKeys.all });
  }, [qc]);

  function handleDelete() {
    if (!id) return;
    deleteProjectMutation.mutate(id, {
      onSuccess: () => navigate('/app/projects'),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <div>
          <div className="flex gap-1 overflow-x-auto border-b pb-px">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  'shrink-0 px-3 py-2 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {t(`projects.tabs.${tab}`)}
              </button>
            ))}
          </div>

          <Card className="mt-3">
            <CardContent className="pt-4">
              {activeTab === 'description' ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {project.description || (
                    <span className="italic text-muted-foreground">
                      {t('projects.no_description')}
                    </span>
                  )}
                </div>
              ) : null}

              {activeTab === 'tasks' ? (
                <TabInteractions
                  projectId={project.id}
                  type="todo"
                  emptyKey="projects.empty_tasks"
                  addUrl={`/app/interactions/new?type=todo&project_id=${project.id}${project.zones.length > 0 ? `&zone_id=${project.zones[0].id}` : ''}`}
                  addLabel={t('projects.add_task')}
                />
              ) : null}

              {activeTab === 'notes' ? (
                <TabInteractions
                  projectId={project.id}
                  type="note"
                  emptyKey="projects.empty_notes"
                  addUrl={`/app/interactions/new?type=note&project_id=${project.id}`}
                  addLabel={t('projects.add_note')}
                />
              ) : null}

              {activeTab === 'expenses' ? (
                <TabInteractions
                  projectId={project.id}
                  type="expense"
                  emptyKey="projects.empty_expenses"
                  addUrl={`/app/interactions/new?type=expense&project_id=${project.id}`}
                  addLabel={t('projects.add_expense')}
                />
              ) : null}

              {activeTab === 'documents' ? (
                <TabInteractions
                  projectId={project.id}
                  type="document"
                  emptyKey="projects.empty_documents"
                />
              ) : null}

              {activeTab === 'timeline' ? (
                <TabInteractions
                  projectId={project.id}
                  emptyKey="projects.empty_timeline"
                  addUrl={`/app/interactions/new?project_id=${project.id}`}
                  addLabel={t('projects.add_activity')}
                />
              ) : null}

              {activeTab === 'metrics' ? <MetricsTab projectId={project.id} /> : null}
            </CardContent>
          </Card>
        </div>
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
    </>
  );
}
