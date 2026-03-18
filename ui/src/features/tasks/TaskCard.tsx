import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Lock, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import { useAuth } from '@/lib/auth/context';
import type { HouseholdMember, Task, TaskStatus } from '@/lib/api/tasks';
import { isTaskOverdue, formatRelativeDate } from '@/lib/api/tasks';
import CardActions, { type CardAction } from '@/components/CardActions';
import TaskStatusBadge from './TaskStatusBadge';
import TaskAssigneeBadge from './TaskAssigneeBadge';

interface TaskCardProps {
  task: Task;
  householdMembers: HouseholdMember[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onAssigneeChange: (taskId: string, assignedToId: string | null) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  interactionsBaseUrl?: string;
}

export default function TaskCard({
  task,
  householdMembers,
  onStatusChange,
  onAssigneeChange,
  onEdit,
  onDelete,
  interactionsBaseUrl = '/app/interactions/',
}: TaskCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [assigneeUpdating, setAssigneeUpdating] = React.useState(false);

  const isUpdating = statusUpdating || assigneeUpdating;
  const showAssignee = householdMembers.length > 1 && !task.is_private;

  const overdue = isTaskOverdue(task);
  const isDone = task.status === 'done';
  const relativeDate = formatRelativeDate(task.due_date);
  const zoneName = task.zone_names?.[0];
  const isHighPriority = task.priority === 1;
  const isCreator = user != null && String(task.created_by) === String(user.id);

  const completedAtFormatted = task.completed_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(task.completed_at))
    : null;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    setStatusUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssigneeChange = async (assignedToId: string | null) => {
    if (assignedToId === task.assigned_to) return;
    setAssigneeUpdating(true);
    try {
      await onAssigneeChange(task.id, assignedToId);
    } finally {
      setAssigneeUpdating(false);
    }
  };

  const menuActions: CardAction[] = [
    {
      label: t('tasks.editTask'),
      icon: Pencil,
      onClick: () => onEdit(task),
    },
    ...(isCreator
      ? [
          {
            label: t('tasks.deleteTask'),
            icon: Trash2,
            onClick: () => onDelete(task.id),
            variant: 'danger' as const,
          },
        ]
      : []),
  ];

  return (
    <Card
      className={[
        'p-3 transition-all hover:shadow-md',
        overdue
          ? 'border-orange-300 bg-orange-50/30 dark:border-orange-900 dark:bg-orange-950/20'
          : 'border-border bg-card',
        isDone ? 'opacity-70' : '',
        isUpdating ? 'pointer-events-none opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {isHighPriority && !isDone && (
              <span className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500 ring-2 ring-red-200" title={t('tasks.priorityHigh')} />
            )}
            {task.is_private && (
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
            )}
            <p className={[
              'text-sm font-medium leading-snug',
              overdue ? 'text-orange-900 dark:text-orange-200' : 'text-foreground',
              isDone ? 'line-through' : '',
            ].join(' ')}>
              {task.subject || t('tasks.untitledTask')}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {zoneName ? (
              <span className="font-medium text-foreground/80">{zoneName}</span>
            ) : (
              <span className="text-muted-foreground/60">{t('tasks.noZone')}</span>
            )}

            {relativeDate ? (
              <>
                <span className="text-border">·</span>
                <span className={overdue ? 'font-medium text-orange-600 dark:text-orange-400' : ''}>{relativeDate}</span>
              </>
            ) : null}

            {overdue ? (
              <>
                <span className="text-border">·</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {t('tasks.overdueBadge')}
                </span>
              </>
            ) : null}
          </div>

          {isDone && task.completed_by_name && !(user != null && String(task.completed_by) === String(user.id)) ? (
            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              {t('tasks.completedBy', { name: task.completed_by_name })}
              {completedAtFormatted ? ` · ${completedAtFormatted}` : null}
            </div>
          ) : null}

          {task.project && task.project_title ? (
            <div className="mt-1">
              <a
                href={`/app/projects/${task.project}/`}
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {task.project_title}
              </a>
            </div>
          ) : null}

          {task.source_interaction ? (
            <div className="mt-1.5">
              <a
                href={`${interactionsBaseUrl}?created=${task.source_interaction}`}
                className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
                title={t('tasks.sourceEvent')}
              >
                <Link className="h-3 w-3" />
                {t('tasks.sourceEvent')}
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {showAssignee && (
            <TaskAssigneeBadge
              task={task}
              members={householdMembers}
              currentUserId={user?.id ?? null}
              onChange={handleAssigneeChange}
              disabled={isUpdating}
            />
          )}
          <TaskStatusBadge status={task.status} onChange={handleStatusChange} disabled={isUpdating} />
          <CardActions actions={menuActions} />
        </div>
      </div>
    </Card>
  );
}
