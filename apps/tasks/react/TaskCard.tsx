import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileText, Link, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/design-system/button';
import type { Task, TaskStatus } from '@/lib/api/tasks';
import { nextStatus, prevStatus, isTaskOverdue, formatRelativeDate } from '@/lib/api/tasks';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  interactionsBaseUrl?: string;
  documentsBaseUrl?: string;
}

export default function TaskCard({
  task,
  onStatusChange,
  onEdit,
  interactionsBaseUrl = '/app/interactions/',
  documentsBaseUrl = '/app/documents/',
}: TaskCardProps) {
  const { t } = useTranslation();
  const [moving, setMoving] = React.useState(false);

  const overdue = isTaskOverdue(task);
  const isDone = task.status === 'done';
  const relativeDate = formatRelativeDate(task.occurred_at);

  const sourceInteractionId = task.metadata?.source_interaction_id as string | undefined;
  const hasLinkedDocument = task.document_count > 0;
  const zoneName = task.zone_names?.[0];

  const canGoBack = task.status === 'done';

  const handleAdvance = async () => {
    const newStatus = nextStatus(task.status);
    if (newStatus === task.status) return;
    setMoving(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setMoving(false);
    }
  };

  const handleRevert = async () => {
    const newStatus = prevStatus(task.status);
    if (newStatus === task.status) return;
    setMoving(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className={[
        'rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
        overdue ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200',
        isDone ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${overdue ? 'text-orange-900' : 'text-slate-900'} ${isDone ? 'line-through' : ''}`}>
            {task.subject || t('tasks.untitledTask', { defaultValue: 'Untitled task' })}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {zoneName ? (
              <span className="font-medium text-slate-600">{zoneName}</span>
            ) : (
              <span className="text-slate-400">{t('tasks.noZone', { defaultValue: 'No zone' })}</span>
            )}

            {relativeDate ? (
              <>
                <span className="text-slate-300">·</span>
                <span className={overdue ? 'font-medium text-orange-600' : ''}>{relativeDate}</span>
              </>
            ) : null}

            {overdue ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-orange-600">
                  {t('tasks.overdueBadge', { defaultValue: 'Overdue' })}
                </span>
              </>
            ) : null}
          </div>

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

          {(sourceInteractionId || hasLinkedDocument) ? (
            <div className="mt-1.5 flex items-center gap-2">
              {sourceInteractionId ? (
                <a
                  href={`${interactionsBaseUrl}?created=${sourceInteractionId}`}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 hover:underline"
                  title={t('tasks.sourceEvent', { defaultValue: 'Source event' })}
                >
                  <Link className="h-3 w-3" />
                  {t('tasks.sourceEvent', { defaultValue: 'Event' })}
                </a>
              ) : null}
              {hasLinkedDocument ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-violet-600"
                  title={t('tasks.sourceDocumentLink', { defaultValue: 'Linked document' })}
                >
                  <FileText className="h-3 w-3" />
                  {t('tasks.sourceDocumentLink', { defaultValue: 'Document' })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          {canGoBack ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-slate-500"
              onClick={handleRevert}
              disabled={moving}
              aria-label={t('tasks.revertStatus', { defaultValue: 'Revert status' })}
              type="button"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(task)}
            aria-label={t('tasks.editTask', { defaultValue: 'Edit task' })}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          {!isDone ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-emerald-600"
              onClick={handleAdvance}
              disabled={moving}
              aria-label={t('tasks.advanceStatus', { defaultValue: 'Advance status' })}
              type="button"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
