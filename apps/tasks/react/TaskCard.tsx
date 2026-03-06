import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/design-system/button';
import type { Task, TaskColumnId, TaskStatus } from '@/lib/api/tasks';
import { nextStatus, prevStatus, COLUMN_SEQUENCE } from '@/lib/api/tasks';

const STATUS_BADGE: Record<TaskColumnId, string> = {
  backlog: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABEL_KEY: Record<TaskColumnId, string> = {
  backlog: 'tasks.statusLabels.backlog',
  pending: 'tasks.statusLabels.pending',
  in_progress: 'tasks.statusLabels.in_progress',
  done: 'tasks.statusLabels.done',
};

const STATUS_LABEL_DEFAULT: Record<TaskColumnId, string> = {
  backlog: 'Backlog',
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
};

interface TaskCardProps {
  task: Task;
  columnId: TaskColumnId;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export default function TaskCard({ task, columnId, onStatusChange }: TaskCardProps) {
  const { t } = useTranslation();
  const [moving, setMoving] = React.useState(false);

  const formattedDate = React.useMemo(() => {
    if (!task.occurred_at) return null;
    const date = new Date(task.occurred_at);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }, [task.occurred_at]);

  const currentIdx = COLUMN_SEQUENCE.indexOf(columnId);
  const canGoLeft = currentIdx > 0;
  const canGoRight = currentIdx < COLUMN_SEQUENCE.length - 1;

  const handleMove = (direction: 'left' | 'right') => {
    const newStatus = direction === 'right' ? nextStatus(task.status) : prevStatus(task.status);
    if (newStatus === task.status) return;
    setMoving(true);
    onStatusChange(task.id, newStatus).finally(() => setMoving(false));
  };

  return (
    <div
      className={`space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        moving ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-900 leading-snug">
          {task.subject || t('tasks.untitledTask', { defaultValue: 'Untitled task' })}
        </h3>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_BADGE[columnId]}`}
        >
          {t(STATUS_LABEL_KEY[columnId], { defaultValue: STATUS_LABEL_DEFAULT[columnId] })}
        </span>
      </div>

      {task.content ? (
        <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{task.content}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          {formattedDate ?? t('tasks.noDate', { defaultValue: 'No date' })}
        </span>

        <div className="flex items-center gap-1">
          {canGoLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-700"
              disabled={moving}
              onClick={() => handleMove('left')}
              aria-label={t('tasks.movePrev', { defaultValue: 'Move to previous column' })}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {canGoRight && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-700"
              disabled={moving}
              onClick={() => handleMove('right')}
              aria-label={t('tasks.moveNext', { defaultValue: 'Move to next column' })}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
