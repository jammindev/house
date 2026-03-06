import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchTasks,
  updateTaskStatus,
  groupTasksByColumn,
  COLUMN_SEQUENCE,
  type Task,
  type TaskColumnId,
  type TaskStatus,
} from '@/lib/api/tasks';
import { useHouseholdId } from '@/lib/useHouseholdId';
import TaskColumn from './TaskColumn';
import NewTaskDialog from './NewTaskDialog';

type TasksPageProps = Record<string, never>;

export default function TasksPage(_props: TasksPageProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTasks = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTasks(householdId)
      .then((list) => {
        // Exclude archived tasks (= legacy hideArchived)
        setTasks(list.filter((t) => t.status !== 'archived'));
        setLoading(false);
      })
      .catch(() => {
        setError(t('tasks.loadFailed', { defaultValue: 'Failed to load tasks.' }));
        setLoading(false);
      });
  }, [householdId, t]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
      );
      try {
        await updateTaskStatus(taskId, newStatus, householdId);
      } catch {
        // Rollback on error
        loadTasks();
      }
    },
    [householdId, loadTasks],
  );

  const tasksByColumn = React.useMemo(() => groupTasksByColumn(tasks), [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('tasks.title', { defaultValue: 'Tasks' })}
          </h1>
          {!loading && !error && tasks.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('tasks.count', { count: tasks.length, defaultValue: '{{count}} tasks' })}
            </p>
          )}
        </div>
        <NewTaskDialog onCreated={loadTasks} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={loadTasks}
            className="ml-2 underline hover:no-underline"
          >
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_SEQUENCE.map((col) => (
            <div
              key={col}
              className="flex min-h-[420px] min-w-[260px] flex-shrink-0 animate-pulse flex-col rounded-xl border-2 border-slate-200 bg-slate-100 p-4"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_SEQUENCE.map((columnId: TaskColumnId) => (
            <TaskColumn
              key={columnId}
              columnId={columnId}
              tasks={tasksByColumn[columnId]}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
