// Réexport des formatters partagés + helpers de statut/échéance projet.
import type { ProjectListItem, ProjectStatus } from '@/lib/api/projects';

export { formatDate, formatDateTime } from '@/lib/format';

export function statusVariant(
  status: ProjectStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'completed') return 'secondary';
  if (status === 'on_hold') return 'outline';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

export function isOverdue(project: ProjectListItem): boolean {
  if (!project.due_date) return false;
  if (project.status === 'completed' || project.status === 'cancelled') return false;
  return new Date(project.due_date) < new Date();
}

export function isDueSoon(project: ProjectListItem): boolean {
  if (!project.due_date) return false;
  if (project.status === 'completed' || project.status === 'cancelled') return false;
  const diffDays = (new Date(project.due_date).getTime() - Date.now()) / 86_400_000;
  return diffDays >= 0 && diffDays <= 14;
}
