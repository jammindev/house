import * as React from 'react';
import { CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  fetchTasks,
  fetchHouseholdMembers,
  updateTaskStatus,
  deleteTask,
  isTaskOverdue,
  type Task,
  type TaskStatus,
  type HouseholdMember,
} from '@/lib/api/tasks';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import ListPage from '@/components/ListPage';
import NewTaskDialog from './NewTaskDialog';
import TaskSection from './TaskSection';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'backlog' | 'done';

export default function TasksPage() {
  const { t } = useTranslation();
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [householdMembers, setHouseholdMembers] = React.useState<HouseholdMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>('all');
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);

  const loadTasks = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTasks()
      .then((list) => {
        setTasks(list.filter((task) => task.status !== 'archived'));
        setLoading(false);
      })
      .catch(() => {
        setError(t('tasks.loadFailed'));
        setLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  React.useEffect(() => {
    fetchHouseholdMembers().then(setHouseholdMembers).catch(() => {});
  }, []);

  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
      );
      try {
        await updateTaskStatus(taskId, newStatus);
      } catch {
        loadTasks();
      }
    },
    [loadTasks],
  );

  const handleTaskUpdated = React.useCallback((updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  }, []);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('tasks.deleted', { defaultValue: 'Tâche supprimée' }),
    onDelete: (id) => deleteTask(id),
  });

  const handleTaskDeleted = React.useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      deleteWithUndo(taskId, {
        onRemove: () => setTasks((prev) => prev.filter((t) => t.id !== taskId)),
        onRestore: () => setTasks((prev) => [...prev, task]),
      });
    },
    [tasks, deleteWithUndo],
  );

  // Compute sections
  const overdueTasks = React.useMemo(
    () => tasks.filter((t) => isTaskOverdue(t)),
    [tasks],
  );

  const inProgressTasks = React.useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' && !isTaskOverdue(t)),
    [tasks],
  );

  const pendingTasks = React.useMemo(
    () => tasks.filter((t) => t.status === 'pending' && !isTaskOverdue(t)),
    [tasks],
  );

  const backlogTasks = React.useMemo(
    () => tasks.filter((t) => (t.status === 'backlog' || t.status === null) && !isTaskOverdue(t)),
    [tasks],
  );

  const doneTasks = React.useMemo(
    () => tasks.filter((t) => t.status === 'done'),
    [tasks],
  );

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('tasks.filter.all') },
    { key: 'pending', label: t('tasks.filter.pending') },
    { key: 'in_progress', label: t('tasks.filter.in_progress') },
    { key: 'backlog', label: t('tasks.filter.backlog') },
    { key: 'done', label: t('tasks.filter.done') },
  ];

  const visibleBySection = React.useMemo(() => {
    if (activeFilter === 'all') {
      return { overdue: overdueTasks, in_progress: inProgressTasks, pending: pendingTasks, backlog: backlogTasks, done: doneTasks };
    }
    const overdueVisible = activeFilter !== 'done' ? overdueTasks : [];
    return {
      overdue: overdueVisible,
      in_progress: activeFilter === 'in_progress' ? inProgressTasks : [],
      pending: activeFilter === 'pending' ? pendingTasks : [],
      backlog: activeFilter === 'backlog' ? backlogTasks : [],
      done: activeFilter === 'done' ? doneTasks : [],
    };
  }, [activeFilter, overdueTasks, inProgressTasks, pendingTasks, backlogTasks, doneTasks]);

  const isEmpty = !loading && !error && tasks.length === 0;

  return (
    <>
      <ListPage
        title={t('tasks.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: CheckSquare,
          title: t('tasks.empty'),
          description: t('tasks.empty_description'),
          action: { label: t('tasks.new'), onClick: () => setNewTaskOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setNewTaskOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('tasks.new')}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeFilter === key
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
              <button type="button" onClick={loadTasks} className="ml-2 underline hover:no-underline">
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {/* Loading skeleton */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : null}

          {/* Sections */}
          {!loading && !error ? (
            <div className="space-y-5">
              <TaskSection
                key="overdue"
                title={t('tasks.sections.overdue')}
                tasks={visibleBySection.overdue}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                onDelete={handleTaskDeleted}
              />
              <TaskSection
                key="in_progress"
                title={t('tasks.sections.in_progress')}
                tasks={visibleBySection.in_progress}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                onDelete={handleTaskDeleted}
              />
              <TaskSection
                key="pending"
                title={t('tasks.sections.pending')}
                tasks={visibleBySection.pending}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                onDelete={handleTaskDeleted}
              />
              <TaskSection
                key="backlog"
                title={t('tasks.sections.backlog')}
                tasks={visibleBySection.backlog}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                onDelete={handleTaskDeleted}
              />
              <TaskSection
                key="done"
                title={t('tasks.sections.done')}
                tasks={visibleBySection.done}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                onDelete={handleTaskDeleted}
              />
            </div>
          ) : null}
        </div>
      </ListPage>

      {/* Create dialog */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={loadTasks}
        householdMembers={householdMembers}
      />

      {/* Edit dialog */}
      <NewTaskDialog
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreated={loadTasks}
        existingTask={editingTask ?? undefined}
        onUpdated={handleTaskUpdated}
        householdMembers={householdMembers}
      />
    </>
  );
}
