import { Link } from 'react-router-dom';
import { Pencil, Trash2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import type { ProjectListItem, ProjectStatus, ProjectType } from '@/lib/api/projects';

function statusVariant(status: ProjectStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'completed') return 'secondary';
  if (status === 'on_hold') return 'outline';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

function typeColor(type: ProjectType): string {
  const map: Record<ProjectType, string> = {
    renovation: 'bg-amber-50 text-amber-800 border-amber-200',
    maintenance: 'bg-blue-50 text-blue-800 border-blue-200',
    repair: 'bg-red-50 text-red-800 border-red-200',
    purchase: 'bg-green-50 text-green-800 border-green-200',
    relocation: 'bg-purple-50 text-purple-800 border-purple-200',
    vacation: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    leisure: 'bg-pink-50 text-pink-800 border-pink-200',
    other: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return map[type] ?? map.other;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function isOverdue(project: ProjectListItem): boolean {
  if (!project.due_date) return false;
  if (project.status === 'completed' || project.status === 'cancelled') return false;
  return new Date(project.due_date) < new Date();
}

function isDueSoon(project: ProjectListItem): boolean {
  if (!project.due_date) return false;
  if (project.status === 'completed' || project.status === 'cancelled') return false;
  const diffDays = (new Date(project.due_date).getTime() - Date.now()) / 86_400_000;
  return diffDays >= 0 && diffDays <= 14;
}

function BudgetBar({ planned, actual }: { planned: number; actual: number }) {
  if (!planned) return null;
  const pct = Math.min((actual / planned) * 100, 100);
  const overBudget = actual > planned;
  return (
    <div className="mt-1">
      <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{actual.toFixed(0)}€</span>
        <span>{planned.toFixed(0)}€</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectListItem;
  onEdit: (project: ProjectListItem) => void;
  onDelete: (projectId: string) => void;
  onTogglePin?: (project: ProjectListItem) => void;
  pinLoading?: boolean;
}

export default function ProjectCard({
  project,
  onEdit,
  onDelete,
  onTogglePin,
  pinLoading = false,
}: ProjectCardProps) {
  const { t } = useTranslation();
  const overdue = isOverdue(project);
  const dueSoon = isDueSoon(project);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/app/projects/${project.id}`}
            className="truncate text-sm font-semibold leading-tight text-slate-900 hover:text-primary hover:underline"
          >
            {project.title}
          </Link>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          {onTogglePin ? (
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${project.is_pinned ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
              onClick={() => onTogglePin(project)}
              disabled={pinLoading}
              aria-label={project.is_pinned ? t('projects.unpin') : t('projects.pin')}
              type="button"
            >
              <Star
                className="h-3.5 w-3.5"
                fill={project.is_pinned ? 'currentColor' : 'none'}
              />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(project.id)}
            aria-label={t('projects.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(project)}
            aria-label={t('projects.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${typeColor(project.type)}`}
        >
          {t(`projects.type.${project.type}`)}
        </span>
        <Badge variant={statusVariant(project.status)} className="h-5 text-[10px]">
          {t(`projects.status.${project.status}`)}
        </Badge>
        {overdue ? (
          <Badge variant="destructive" className="h-5 text-[10px]">
            {t('projects.overdue')}
          </Badge>
        ) : dueSoon ? (
          <Badge variant="secondary" className="h-5 text-[10px]">
            {t('projects.due_soon')}
          </Badge>
        ) : null}
        {project.project_group_name ? (
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {project.project_group_name}
          </span>
        ) : null}
        {project.zones.length > 0 ? (
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {project.zones.map((z) => z.name).join(', ')}
          </span>
        ) : null}
      </div>

      {project.due_date || project.start_date ? (
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          {project.start_date ? (
            <span>
              <span className="font-medium">{t('projects.start_date')}: </span>
              {formatDate(project.start_date)}
            </span>
          ) : null}
          {project.due_date ? (
            <span>
              <span className="font-medium">{t('projects.due_date')}: </span>
              {formatDate(project.due_date)}
            </span>
          ) : null}
        </div>
      ) : null}

      {Number(project.planned_budget) > 0 || Number(project.actual_cost_cached) > 0 ? (
        <div className="mt-3">
          <div className="mb-1 text-xs text-muted-foreground">
            <span className="font-medium">{t('projects.budget')}</span>
          </div>
          <BudgetBar
            planned={Number(project.planned_budget)}
            actual={Number(project.actual_cost_cached)}
          />
        </div>
      ) : null}
    </div>
  );
}
