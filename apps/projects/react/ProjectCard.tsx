import { useTranslation } from 'react-i18next';

import { Badge } from '@/design-system/badge';
import { Card } from '@/design-system/card';
import type { ProjectListItem, ProjectStatus, ProjectType } from '@/lib/api/projects';

function statusVariant(status: ProjectStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'on_hold') return 'secondary';
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
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{actual.toFixed(0)}€</span>
        <span>{planned.toFixed(0)}€</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
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
  detailUrl: string;
  onTogglePin?: (project: ProjectListItem) => void;
  pinLoading?: boolean;
}

export default function ProjectCard({ project, detailUrl, onTogglePin, pinLoading }: ProjectCardProps) {
  const { t } = useTranslation();
  const overdue = isOverdue(project);
  const dueSoon = isDueSoon(project);

  return (
    <a href={detailUrl} className="block">
      <Card className="rounded-lg border border-2 bg-card text-card-foreground hover:shadow-md transition-all">
        <div className="p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{project.title}</h3>
              {project.description ? (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
              ) : null}
            </div>
            {onTogglePin ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(project); }}
                disabled={pinLoading}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                aria-label={project.is_pinned ? t('projects.unpin') : t('projects.pin')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={project.is_pinned ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  className={project.is_pinned ? 'text-primary' : ''}
                >
                  <path d="M12 2l3.5 7 7.5 1-5.5 5.4 1.3 7.6L12 20l-6.8 3L6.5 15.4 1 10l7.5-1z" />
                </svg>
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${typeColor(project.type)}`}>
              {t(`projects.type.${project.type}`)}
            </span>
            <Badge variant={statusVariant(project.status)} className="text-[10px] h-5">
              {t(`projects.status.${project.status}`)}
            </Badge>
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              P{project.priority}
            </span>
            {overdue ? (
              <Badge variant="destructive" className="text-[10px] h-5">{t('projects.overdue')}</Badge>
            ) : dueSoon ? (
              <Badge variant="secondary" className="text-[10px] h-5">{t('projects.due_soon')}</Badge>
            ) : null}
            {project.project_group_name ? (
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {project.project_group_name}
              </span>
            ) : null}
          </div>

          {project.due_date ? (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium">{t('projects.due_date')}: </span>
              {formatDate(project.due_date)}
            </div>
          ) : null}

          {(Number(project.planned_budget) > 0 || Number(project.actual_cost_cached) > 0) ? (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">
                <span className="font-medium">{t('projects.budget')}</span>
              </div>
              <BudgetBar
                planned={Number(project.planned_budget)}
                actual={Number(project.actual_cost_cached)}
              />
            </div>
          ) : null}
        </div>
      </Card>
    </a>
  );
}
