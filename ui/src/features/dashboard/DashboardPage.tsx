import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderKanban,
  ListTodo,
  Plus,
  Receipt,
  Settings2,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { Button, buttonVariants } from '@/design-system/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { cn } from '@/lib/utils';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import AlertsSection from '@/features/alerts/AlertsSection';

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardTone = 'slate' | 'sky' | 'amber' | 'emerald' | 'rose';

interface TaskItem {
  id: string;
  subject: string;
  status: string;
  due_date?: string | null;
}

interface ProjectItem {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
}

interface DocItem {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

interface InteractionItem {
  id: string;
  subject: string;
  type: string;
  occurred_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const p = data as { results?: T[] };
  return Array.isArray(p.results) ? p.results : [];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TONE_STYLES: Record<DashboardTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

const SECTION_LAYOUT: Record<string, string> = {
  tasks: 'xl:col-span-4',
  projects: 'xl:col-span-4',
  activity: 'xl:col-span-4',
  documents: 'xl:col-span-4',
};

const ICONS: Record<string, LucideIcon> = {
  activity: Sparkles,
  calendar: CalendarClock,
  documents: FileText,
  plus: Plus,
  projects: FolderKanban,
  settings: Settings2,
  tasks: ListTodo,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  helper: string;
  href: string;
  icon: string;
  tone: DashboardTone;
  isLoading: boolean;
}

function SummaryCard({ label, value, helper, href, icon, tone, isLoading }: SummaryCardProps) {
  const Icon = ICONS[icon] ?? Sparkles;
  const showSkeleton = useDelayedLoading(isLoading);
  return (
    <a href={href} className="block">
      <Card className="h-full overflow-hidden border-border/70 bg-card/95 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', TONE_STYLES[tone])}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl font-semibold tracking-tight">
            {showSkeleton ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-100" /> : value}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{helper}</p>
        </CardContent>
      </Card>
    </a>
  );
}

interface SectionItem {
  id: string;
  title: string;
  url?: string;
  badge?: { label: string; tone: DashboardTone };
  meta?: Array<{ label: string; value: string }>;
}

interface SectionPanelProps {
  id: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  icon: string;
  emptyMessage: string;
  items: SectionItem[];
  isLoading: boolean;
}

function SectionPanel({ id, title, description, href, hrefLabel, icon, emptyMessage, items, isLoading }: SectionPanelProps) {
  const Icon = ICONS[icon] ?? Sparkles;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <Card className={cn('border-border/70 bg-card/95', SECTION_LAYOUT[id] ?? 'xl:col-span-4')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/80 bg-muted/60 text-foreground/80">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
          <a href={href} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {hrefLabel}
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showSkeleton ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className={cn('rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-border hover:bg-background', item.url ? 'cursor-pointer' : '')}>
              {item.url ? (
                <a href={item.url} className="block">
                  <SectionItemContent item={item} />
                </a>
              ) : (
                <SectionItemContent item={item} />
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionItemContent({ item }: { item: SectionItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
        {item.badge ? (
          <Badge variant="outline" className={cn('border px-2 py-0.5 text-[11px] font-medium', TONE_STYLES[item.badge.tone])}>
            {item.badge.label}
          </Badge>
        ) : null}
      </div>
      {item.meta && item.meta.length > 0 ? (
        <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {item.meta.map((entry) => (
            <div key={entry.label} className="min-w-0">
              <dt className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">{entry.label}</dt>
              <dd className="truncate text-foreground/80">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

// ── Type selector dialog ───────────────────────────────────────────────────────

const PRIMARY_TYPES: Array<{ type: string; Icon: LucideIcon }> = [
  { type: 'note', Icon: FileText },
  { type: 'todo', Icon: CheckSquare },
  { type: 'expense', Icon: Receipt },
  { type: 'maintenance', Icon: Wrench },
];

const SECONDARY_TYPES = [
  'repair',
  'installation',
  'inspection',
  'warranty',
  'issue',
  'upgrade',
  'replacement',
  'disposal',
];

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddEventDialog({ open, onOpenChange }: AddEventDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = React.useState(false);

  function handleSelect(type: string) {
    onOpenChange(false);
    navigate(`/app/interactions/new?type=${type}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dashboard.select_type')}</DialogTitle>
        </DialogHeader>

        {/* Primary types */}
        <div className="grid grid-cols-2 gap-2">
          {PRIMARY_TYPES.map(({ type, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-muted/60"
            >
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {t(`interactions.type.${type}`)}
            </button>
          ))}
        </div>

        {/* Secondary types (expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span>{t('dashboard.more_types')}</span>
            {showMore ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          {showMore ? (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {SECONDARY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="rounded-lg border border-border/50 bg-background px-3 py-2 text-left text-xs font-medium text-foreground/80 transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                >
                  {t(`interactions.type.${type}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();
  const [addEventOpen, setAddEventOpen] = React.useState(false);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/tasks/', { params: { status: 'pending', limit: 5 } });
      return normalizeList<TaskItem>(data);
    },
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/projects/projects/', { params: { status: 'active', limit: 5 } });
      return normalizeList<ProjectItem>(data);
    },
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['documents', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/documents/documents/', { params: { limit: 5 } });
      return normalizeList<DocItem>(data);
    },
  });

  const { data: interactions = [], isLoading: interactionsLoading } = useQuery({
    queryKey: ['interactions', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/interactions/interactions/', { params: { limit: 6 } });
      return normalizeList<InteractionItem>(data);
    },
  });

  return (
    <div className="space-y-6">
      <AddEventDialog open={addEventOpen} onOpenChange={setAddEventOpen} />

      {/* Add event CTA */}
      <div>
        <Button
          onClick={() => setAddEventOpen(true)}
          className="w-full sm:w-auto"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('dashboard.add_event')}
        </Button>
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(110,231,183,0.20),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] p-6 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.09),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.96))] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700/80 dark:text-sky-300/70">
              {t('dashboard.header.eyebrow')}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t('dashboard.header.title')}
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {t('dashboard.header.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/app/projects" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <FolderKanban className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('dashboard.actions.newProject')}
            </a>
            <a href="/app/tasks" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <ListTodo className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('dashboard.actions.openTasks')}
            </a>
          </div>
        </div>
      </section>

      {/* Alertes proactives */}
      <AlertsSection />

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t('dashboard.summary.projects.label')}
          value={projects.length}
          helper={t('dashboard.summary.projects.helper', { count: 0 })}
          href="/app/projects"
          icon="projects"
          tone="sky"
          isLoading={projectsLoading}
        />
        <SummaryCard
          label={t('dashboard.summary.tasks.label')}
          value={tasks.length}
          helper={t('dashboard.summary.tasks.helper')}
          href="/app/tasks"
          icon="tasks"
          tone="amber"
          isLoading={tasksLoading}
        />
        <SummaryCard
          label={t('dashboard.summary.documents.label')}
          value={docs.length}
          helper={t('dashboard.summary.documents.helper')}
          href="/app/documents"
          icon="documents"
          tone="emerald"
          isLoading={docsLoading}
        />
        <SummaryCard
          label={t('dashboard.summary.activity.label')}
          value={interactions.length}
          helper={t('dashboard.summary.activity.helper')}
          href="/app/interactions"
          icon="activity"
          tone="slate"
          isLoading={interactionsLoading}
        />
      </section>

      {/* Sections */}
      <section className="grid gap-4 lg:grid-cols-12 xl:grid-cols-12">
        <SectionPanel
          id="tasks"
          title={t('dashboard.sections.tasks.title')}
          description={t('dashboard.sections.tasks.description')}
          href="/app/tasks"
          hrefLabel={t('dashboard.sections.tasks.cta')}
          icon="tasks"
          emptyMessage={t('dashboard.sections.tasks.empty')}
          isLoading={tasksLoading}
          items={tasks.map((task) => ({
            id: task.id,
            title: task.subject,
            url: '/app/tasks',
            badge: { label: task.status, tone: 'amber' as DashboardTone },
            meta: task.due_date ? [{ label: t('dashboard.meta.dueDate'), value: task.due_date }] : [],
          }))}
        />
        <SectionPanel
          id="projects"
          title={t('dashboard.sections.pinned.title')}
          description={t('dashboard.sections.pinned.description')}
          href="/app/projects"
          hrefLabel={t('dashboard.sections.pinned.cta')}
          icon="projects"
          emptyMessage={t('dashboard.sections.pinned.empty')}
          isLoading={projectsLoading}
          items={projects.map((project) => ({
            id: project.id,
            title: project.title,
            url: `/app/projects/${project.id}`,
            badge: { label: project.status, tone: 'sky' as DashboardTone },
            meta: project.due_date ? [{ label: t('dashboard.meta.dueDate'), value: project.due_date }] : [],
          }))}
        />
        <SectionPanel
          id="activity"
          title={t('dashboard.sections.activity.title')}
          description={t('dashboard.sections.activity.description')}
          href="/app/interactions"
          hrefLabel={t('dashboard.sections.activity.cta')}
          icon="activity"
          emptyMessage={t('dashboard.sections.activity.empty')}
          isLoading={interactionsLoading}
          items={interactions.map((item) => ({
            id: item.id,
            title: item.subject,
            url: '/app/interactions',
            badge: { label: item.type, tone: 'slate' as DashboardTone },
            meta: [{ label: t('dashboard.meta.when'), value: new Date(item.occurred_at).toLocaleDateString() }],
          }))}
        />
        <SectionPanel
          id="documents"
          title={t('dashboard.sections.documents.title')}
          description={t('dashboard.sections.documents.description')}
          href="/app/documents"
          hrefLabel={t('dashboard.sections.documents.cta')}
          icon="documents"
          emptyMessage={t('dashboard.sections.documents.empty')}
          isLoading={docsLoading}
          items={docs.map((doc) => ({
            id: doc.id,
            title: doc.name,
            url: '/app/documents',
            badge: { label: doc.type, tone: 'slate' as DashboardTone },
            meta: [{ label: t('dashboard.meta.added'), value: new Date(doc.created_at).toLocaleDateString() }],
          }))}
        />
      </section>
    </div>
  );
}
