import * as React from 'react';
import { CheckSquare, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { isTaskOverdue, type Task, type TaskStatus } from '@/lib/api/tasks';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import ListPage from '@/components/ListPage';
import {
  useTasks, useHouseholdMembers, useUpdateTaskStatus, useDeleteTask,
  taskKeys,
} from './hooks';
import TaskSection from './TaskSection';
import NewTaskDialog from './NewTaskDialog';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'backlog' | 'done';

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export default function TasksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>('all');
  const [showPrivateOnly, setShowPrivateOnly] = React.useState(false);

  const { data: tasks = [], isLoading, error } = useTasks();
  const { data: householdMembers = [] } = useHouseholdMembers();
  const updateStatus = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();

  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      await updateStatus.mutateAsync({ id: taskId, status: newStatus });
    },
    [updateStatus],
  );

  const handleTaskSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: taskKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('tasks.deleted', { defaultValue: 'Tâche supprimée' }),
    onDelete: (id) => deleteTaskMutation.mutateAsync(id),
  });

  const handleTaskDeleted = React.useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      deleteWithUndo(taskId, {
        onRemove: () =>
          qc.setQueryData<Task[]>(taskKeys.list(), (old) => old?.filter((t) => t.id !== taskId)),
        onRestore: () =>
          qc.setQueryData<Task[]>(taskKeys.list(), (old) => (old ? [...old, task] : [task])),
      });
    },
    [tasks, deleteWithUndo, qc],
  );

  const filteredTasks = React.useMemo(
    () => (showPrivateOnly ? tasks.filter((t) => t.is_private) : tasks),
    [tasks, showPrivateOnly],
  );

  const overdueTasks = React.useMemo(() => sortByPriority(filteredTasks.filter(isTaskOverdue)), [filteredTasks]);
  const inProgressTasks = React.useMemo(() => sortByPriority(filteredTasks.filter((t) => t.status === 'in_progress' && !isTaskOverdue(t))), [filteredTasks]);
  const pendingTasks = React.useMemo(() => sortByPriority(filteredTasks.filter((t) => t.status === 'pending' && !isTaskOverdue(t))), [filteredTasks]);
  const backlogTasks = React.useMemo(() => sortByPriority(filteredTasks.filter((t) => (t.status === 'backlog' || t.status === null) && !isTaskOverdue(t))), [filteredTasks]);
  const doneTasks = React.useMemo(() => filteredTasks.filter((t) => t.status === 'done'), [filteredTasks]);

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

  const isEmpty = !isLoading && !error && tasks.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrivateOnly((v) => !v)}
              className={[
                'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
                showPrivateOnly
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              title={t('tasks.filterPrivate', { defaultValue: 'My private tasks' })}
            >
              <Lock className="h-3.5 w-3.5" />
              {t('tasks.filterPrivate', { defaultValue: 'Private' })}
            </button>
            <button
              type="button"
              onClick={() => setNewTaskOpen(true)}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t('tasks.new')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
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

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {t('tasks.loadFailed')}
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: taskKeys.all })}
                className="ml-2 underline hover:no-underline"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            <div className="space-y-5">
              <TaskSection key="overdue" title={t('tasks.sections.overdue')} tasks={visibleBySection.overdue} onStatusChange={handleStatusChange} onEdit={setEditingTask} onDelete={handleTaskDeleted} highlightHeader />
              <TaskSection key="in_progress" title={t('tasks.sections.in_progress')} tasks={visibleBySection.in_progress} onStatusChange={handleStatusChange} onEdit={setEditingTask} onDelete={handleTaskDeleted} />
              <TaskSection key="pending" title={t('tasks.sections.pending')} tasks={visibleBySection.pending} onStatusChange={handleStatusChange} onEdit={setEditingTask} onDelete={handleTaskDeleted} />
              <TaskSection key="backlog" title={t('tasks.sections.backlog')} tasks={visibleBySection.backlog} onStatusChange={handleStatusChange} onEdit={setEditingTask} onDelete={handleTaskDeleted} />
              <TaskSection key="done" title={t('tasks.sections.done')} tasks={visibleBySection.done} onStatusChange={handleStatusChange} onEdit={setEditingTask} onDelete={handleTaskDeleted} />
            </div>
          ) : null}
        </div>
      </ListPage>

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={handleTaskSaved}
        householdMembers={householdMembers}
      />

      <NewTaskDialog
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreated={handleTaskSaved}
        existingTask={editingTask ?? undefined}
        onUpdated={handleTaskSaved}
        householdMembers={householdMembers}
      />
    </>
  );
}
