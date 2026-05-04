import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/design-system/button';
import { Textarea } from '@/design-system/textarea';
import { useProjectTasks } from '@/features/tasks/hooks';
import { useProjectInteractions, projectKeys } from './hooks';
import { useCreateInteraction, interactionKeys } from '@/features/interactions/hooks';
import { fetchZones, findRootZone, type Zone } from '@/lib/api/zones';
import { toast } from '@/lib/toast';
import type { ProjectListItem } from '@/lib/api/projects';
import type { Task } from '@/lib/api/tasks';

const PREVIEW_LIMIT = 5;

interface Props {
  project: ProjectListItem;
  onAddTask: () => void;
}

export default function ProjectDashboard({ project, onAddTask }: Props) {
  return (
    <div className="space-y-6">
      <DescriptionSection project={project} />
      <IndicatorsSection project={project} />
      <TasksSection projectId={project.id} onAdd={onAddTask} />
      <NotesSection project={project} />
    </div>
  );
}

// ── Description ────────────────────────────────────────────

function DescriptionSection({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {t('projects.dashboard.description')}
      </h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
        {project.description || (
          <span className="italic text-muted-foreground">{t('projects.no_description')}</span>
        )}
      </div>
    </section>
  );
}

// ── Indicators ─────────────────────────────────────────────

function IndicatorsSection({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation();
  const planned = Number(project.planned_budget);
  const actual = Number(project.actual_cost_cached);
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const overBudget = actual > planned && planned > 0;

  return (
    <section className="space-y-4 text-sm">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t('projects.dashboard.indicators')}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{t('projects.metrics.planned_budget')}</p>
          <p className="mt-1 text-xl font-semibold">{planned > 0 ? `${planned.toFixed(2)} €` : '—'}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
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
    </section>
  );
}

// ── Tasks ──────────────────────────────────────────────────

function TasksSection({ projectId, onAdd }: { projectId: string; onAdd: () => void }) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const open = React.useMemo(
    () => tasks.filter(isOpenTask).slice(0, PREVIEW_LIMIT),
    [tasks],
  );
  const totalOpen = tasks.filter(isOpenTask).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('projects.dashboard.tasks', { count: totalOpen })}
        </h3>
        <Button
          type="button"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3" />
          {t('tasks.new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{t('projects.empty_tasks')}</p>
      ) : (
        <ul className="space-y-1.5">
          {open.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{task.subject}</span>
              {task.due_date ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(task.due_date)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isOpenTask(task: Task): boolean {
  return task.status !== 'done' && task.status !== 'archived';
}

// ── Notes ──────────────────────────────────────────────────

function NotesSection({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation();
  const { data: notes = [], isLoading } = useProjectInteractions(project.id, 'note');
  const previewNotes = notes.slice(0, PREVIEW_LIMIT);

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {t('projects.dashboard.notes')}
      </h3>

      <QuickNoteForm project={project} />

      {isLoading ? (
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : previewNotes.length === 0 ? (
        <p className="mt-3 text-sm italic text-muted-foreground">{t('projects.empty_notes')}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {previewNotes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <p className="font-medium">{n.subject}</p>
              {n.content ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
              ) : null}
              {n.occurred_at ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDateTime(n.occurred_at)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickNoteForm({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const createMutation = useCreateInteraction();
  const [text, setText] = React.useState('');

  // Fetch zones only when project has none — to fall back to the household root zone.
  const needsRoot = project.zones.length === 0;
  const { data: allZones = [] } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: fetchZones,
    enabled: needsRoot,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || createMutation.isPending) return;

    let zoneIds = project.zones.map((z) => z.id);
    if (zoneIds.length === 0) {
      const root = findRootZone(allZones);
      if (!root) {
        toast({ description: t('common.saveFailed'), variant: 'destructive' });
        return;
      }
      zoneIds = [root.id];
    }

    createMutation.mutate(
      {
        subject: trimmed,
        type: 'note',
        occurred_at: new Date().toISOString(),
        zone_ids: zoneIds,
        project: project.id,
      },
      {
        onSuccess: () => {
          setText('');
          void qc.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
          void qc.invalidateQueries({ queryKey: interactionKeys.all });
          toast({ description: t('projects.dashboard.note_added'), variant: 'success' });
        },
        onError: () => {
          toast({ description: t('common.saveFailed'), variant: 'destructive' });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={t('projects.dashboard.quick_note_placeholder')}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          className="h-7 gap-1 px-3 text-xs"
          disabled={!text.trim() || createMutation.isPending}
        >
          <Plus className="h-3 w-3" />
          {t('projects.dashboard.quick_note_save')}
        </Button>
      </div>
    </form>
  );
}

// ── Helpers ────────────────────────────────────────────────

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
