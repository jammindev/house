import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import {
  fetchProject,
  deleteProject,
  pinProject,
  unpinProject,
  type ProjectListItem,
  type ProjectStatus,
} from '@/lib/api/projects';

type Tab = 'description' | 'tasks' | 'notes' | 'expenses' | 'documents' | 'timeline' | 'metrics';

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

// ─── Sub-components ────────────────────────────────────────

interface InteractionItem {
  id: string;
  subject?: string;
  type?: string;
  status?: string | null;
  occurred_at?: string;
  content?: string;
}

function useInteractions(projectId: string, householdId: string | undefined, type?: string) {
  const [items, setItems] = React.useState<InteractionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('project', projectId);
        params.set('ordering', '-occurred_at');
        params.set('limit', '100');
        if (type) params.set('type', type);

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (householdId) headers['X-Household-Id'] = householdId;

        const res = await fetch(`/api/interactions/interactions/?${params.toString()}`, {
          credentials: 'include',
          headers,
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { results?: InteractionItem[] } | InteractionItem[];
        const list = Array.isArray(data) ? data : (data.results ?? []);
        if (mounted) setItems(list);
      } catch {
        if (mounted) setError('error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [projectId, householdId, type]);

  return { items, loading, error };
}

function TabInteractions({
  projectId,
  householdId,
  type,
  emptyKey,
}: {
  projectId: string;
  householdId?: string;
  type?: string;
  emptyKey: string;
}) {
  const { t } = useTranslation();
  const { items, loading, error } = useInteractions(projectId, householdId, type);
  if (loading) return <p className="text-sm text-muted-foreground">{t('projects.loading')}</p>;
  if (error) return (
    <Alert variant="destructive">
      <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium">{item.subject || '—'}</span>
            <div className="flex gap-1 shrink-0">
              {item.type ? (
                <Badge variant="outline" className="text-[10px] h-5">{t(`interactions.type.${item.type}`, { defaultValue: item.type })}</Badge>
              ) : null}
              {item.status ? (
                <Badge variant="secondary" className="text-[10px] h-5">{t(`interactions.status.${item.status}`, { defaultValue: item.status })}</Badge>
              ) : null}
            </div>
          </div>
          {item.content ? <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.content}</p> : null}
          {item.occurred_at ? <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(item.occurred_at)}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function MetricsTab({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation();
  const planned = Number(project.planned_budget);
  const actual = Number(project.actual_cost_cached);
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const overBudget = actual > planned && planned > 0;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t('projects.metrics.planned_budget')}</p>
          <p className="mt-1 text-xl font-semibold">{planned > 0 ? `${planned.toFixed(2)}€` : '—'}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t('projects.metrics.actual_cost')}</p>
          <p className={`mt-1 text-xl font-semibold ${overBudget ? 'text-destructive' : ''}`}>
            {actual > 0 ? `${actual.toFixed(2)}€` : '—'}
          </p>
        </div>
      </div>

      {planned > 0 ? (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t('projects.metrics.budget_used', { pct: pct.toFixed(0) })}</span>
            {overBudget ? <span className="text-destructive">{t('projects.metrics.over_budget')}</span> : null}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${overBudget ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t('projects.start_date')}: {formatDate(project.start_date)}</p>
        <p>{t('projects.due_date')}: {formatDate(project.due_date)}</p>
        {project.closed_at ? <p>{t('projects.closed_at')}: {formatDateTime(project.closed_at)}</p> : null}
      </div>

      {project.zones.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">{t('projects.zones')}</p>
          <div className="flex flex-wrap gap-1">
            {project.zones.map((z) => (
              <span key={z.id} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]" style={z.color ? { borderColor: z.color, color: z.color } : {}}>
                {z.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {project.tags.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">{t('projects.tags')}</p>
          <div className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px]">{tag}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

interface ProjectDetailProps {
  projectId: string;
  householdId?: string;
  editUrl?: string;
  listUrl?: string;
}

const TABS: Tab[] = ['description', 'tasks', 'notes', 'expenses', 'documents', 'timeline', 'metrics'];

export default function ProjectDetail({
  projectId,
  householdId,
  editUrl,
  listUrl = '/app/projects/',
}: ProjectDetailProps) {
  const { t } = useTranslation();
  const [project, setProject] = React.useState<ProjectListItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<Tab>('description');
  const [deleting, setDeleting] = React.useState(false);
  const [pinLoading, setPinLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const item = await fetchProject(projectId, householdId);
      setProject(item);
    } catch {
      setError(t('projects.detail.error_loading'));
    } finally {
      setLoading(false);
    }
  }, [projectId, householdId, t]);

  React.useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!project) return;
    if (!window.confirm(t('projects.delete_confirm'))) return;
    setDeleting(true);
    try {
      await deleteProject(project.id, householdId);
      window.location.assign(listUrl);
    } catch {
      setDeleting(false);
    }
  }

  async function handleTogglePin() {
    if (!project) return;
    setPinLoading(true);
    try {
      const updated = project.is_pinned
        ? await unpinProject(project.id, householdId)
        : await pinProject(project.id, householdId);
      setProject(updated);
    } finally {
      setPinLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('projects.loading')}</p>;
  if (error) return (
    <Alert variant="destructive">
      <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  if (!project) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
              <a href="/app/projects/groups/" className="text-xs text-muted-foreground underline underline-offset-2">
                {project.project_group_name}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleTogglePin}
            disabled={pinLoading}
            className="h-8 w-8 p-0"
            aria-label={project.is_pinned ? t('projects.unpin') : t('projects.pin')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={project.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={project.is_pinned ? 'text-primary' : ''}>
              <path d="M12 2l3.5 7 7.5 1-5.5 5.4 1.3 7.6L12 20l-6.8 3L6.5 15.4 1 10l7.5-1z" />
            </svg>
          </Button>
          {editUrl ? (
            <a href={editUrl} className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">
              {t('projects.edit')}
            </a>
          ) : null}
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting} className="h-8 px-3 text-sm">
            {deleting ? t('projects.deleting') : t('projects.delete')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 overflow-x-auto border-b pb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`projects.tabs.${tab}`)}
            </button>
          ))}
        </div>

        <Card className="mt-3">
          <CardContent className="pt-4">
            {activeTab === 'description' ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {project.description || <span className="text-muted-foreground italic">{t('projects.no_description')}</span>}
              </div>
            ) : null}

            {activeTab === 'tasks' ? (
              <TabInteractions projectId={projectId} householdId={householdId} type="todo" emptyKey="projects.empty_tasks" />
            ) : null}

            {activeTab === 'notes' ? (
              <TabInteractions projectId={projectId} householdId={householdId} type="note" emptyKey="projects.empty_notes" />
            ) : null}

            {activeTab === 'expenses' ? (
              <TabInteractions projectId={projectId} householdId={householdId} type="expense" emptyKey="projects.empty_expenses" />
            ) : null}

            {activeTab === 'documents' ? (
              <TabInteractions projectId={projectId} householdId={householdId} type="document" emptyKey="projects.empty_documents" />
            ) : null}

            {activeTab === 'timeline' ? (
              <TabInteractions projectId={projectId} householdId={householdId} emptyKey="projects.empty_timeline" />
            ) : null}

            {activeTab === 'metrics' ? (
              <MetricsTab project={project} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
