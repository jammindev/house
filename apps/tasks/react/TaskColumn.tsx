import { useTranslation } from 'react-i18next';
import TaskCard from './TaskCard';
import type { Task, TaskColumnId, TaskStatus } from '@/lib/api/tasks';

const COLUMN_BORDER: Record<TaskColumnId, string> = {
  backlog: 'border-slate-200',
  pending: 'border-amber-200',
  in_progress: 'border-blue-200',
  done: 'border-emerald-200',
};

const COLUMN_TITLE_KEY: Record<TaskColumnId, string> = {
  backlog: 'tasks.columns.backlog.title',
  pending: 'tasks.columns.pending.title',
  in_progress: 'tasks.columns.in_progress.title',
  done: 'tasks.columns.done.title',
};

const COLUMN_TITLE_DEFAULT: Record<TaskColumnId, string> = {
  backlog: 'Backlog',
  pending: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface TaskColumnProps {
  columnId: TaskColumnId;
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export default function TaskColumn({ columnId, tasks, onStatusChange }: TaskColumnProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex min-h-[420px] min-w-[260px] flex-shrink-0 flex-col rounded-xl border-2 bg-slate-50/50 p-4 ${COLUMN_BORDER[columnId]}`}
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {t(COLUMN_TITLE_KEY[columnId], { defaultValue: COLUMN_TITLE_DEFAULT[columnId] })}
        </h2>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500 shadow">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={columnId}
              onStatusChange={onStatusChange}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/40 p-6 text-center text-xs text-slate-400">
            <span>{t('tasks.empty', { defaultValue: 'No tasks' })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
