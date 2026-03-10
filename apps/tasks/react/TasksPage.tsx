import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  fetchTasks,
  updateTaskStatus,
  isTaskOverdue,
  type Task,
  type TaskStatus,
} from '@/lib/api/tasks';
import { useHouseholdId } from '@/lib/useHouseholdId';
import { useUrlDialog } from '@/lib/useUrlDialog';
import TaskCard from './TaskCard';
import NewTaskDialog from './NewTaskDialog';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'backlog' | 'done';

interface SectionProps {
  title: string;
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  defaultCollapsed?: boolean;
  highlightHeader?: boolean;
}

function TaskSection({ title, tasks, onStatusChange, onEdit, defaultCollapsed = false, highlightHeader = false }: SectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left text-sm font-semibold transition-colors hover:bg-slate-50 ${
          highlightHeader ? 'text-orange-700' : 'text-slate-700'
        }`}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>
          {title}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${highlightHeader ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
            {tasks.length}
          </span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {!collapsed ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TasksPageProps = Record<string, never>;

export default function TasksPage(_props: TasksPageProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [newTaskOpen, setNewTaskOpen] = useUrlDialog('new-task');
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>('all');
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);

  const loadTasks = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTasks(householdId)
      .then((list) => {
        setTasks(list.filter((task) => task.status !== 'archived'));
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
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
      );
      try {
        await updateTaskStatus(taskId, newStatus, householdId);
      } catch {
        loadTasks();
      }
    },
    [householdId, loadTasks],
  );

  const handleTaskUpdated = React.useCallback((updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  }, []);

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
    { key: 'all', label: t('tasks.filter.all', { defaultValue: 'All' }) },
    { key: 'pending', label: t('tasks.filter.pending', { defaultValue: 'To do' }) },
    { key: 'in_progress', label: t('tasks.filter.in_progress', { defaultValue: 'In progress' }) },
    { key: 'backlog', label: t('tasks.filter.backlog', { defaultValue: 'Backlog' }) },
    { key: 'done', label: t('tasks.filter.done', { defaultValue: 'Done' }) },
  ];

  // Tâches visibles selon le filtre actif
  const visibleBySection = React.useMemo(() => {
    if (activeFilter === 'all') {
      return { overdue: overdueTasks, in_progress: inProgressTasks, pending: pendingTasks, backlog: backlogTasks, done: doneTasks };
    }
    // Quand un filtre est actif, "En retard" reste visible dans tous les cas sauf "Fait"
    const overdueVisible = activeFilter !== 'done' ? overdueTasks : [];
    return {
      overdue: overdueVisible,
      in_progress: activeFilter === 'in_progress' ? inProgressTasks : [],
      pending: activeFilter === 'pending' ? pendingTasks : [],
      backlog: activeFilter === 'backlog' ? backlogTasks : [],
      done: activeFilter === 'done' ? doneTasks : [],
    };
  }, [activeFilter, overdueTasks, inProgressTasks, pendingTasks, backlogTasks, doneTasks]);

  return (
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
            {t('common.retry', { defaultValue: 'Retry' })}
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
            title={t('tasks.sections.overdue', { defaultValue: 'En retard' })}
            tasks={visibleBySection.overdue}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            highlightHeader
          />
          <TaskSection
            key="in_progress"
            title={t('tasks.sections.in_progress', { defaultValue: 'En cours' })}
            tasks={visibleBySection.in_progress}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
          />
          <TaskSection
            key="pending"
            title={t('tasks.sections.pending', { defaultValue: 'À faire' })}
            tasks={visibleBySection.pending}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
          />
          <TaskSection
            key="backlog"
            title={t('tasks.sections.backlog', { defaultValue: 'Backlog' })}
            tasks={visibleBySection.backlog}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            defaultCollapsed
          />
          <TaskSection
            key="done"
            title={t('tasks.sections.done', { defaultValue: 'Fait' })}
            tasks={visibleBySection.done}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            defaultCollapsed
          />

          {tasks.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">
              {t('tasks.empty', { defaultValue: 'No tasks yet.' })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Create dialog */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={loadTasks}
      />

      {/* Edit dialog */}
      <NewTaskDialog
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreated={loadTasks}
        existingTask={editingTask ?? undefined}
        onUpdated={handleTaskUpdated}
      />
    </div>
  );
}
