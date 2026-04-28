import * as React from 'react';
import { CheckSquare, Lock, Plus, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { isTaskOverdue, type Task, type TaskStatus } from '@/lib/api/tasks';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { DropdownSelect } from '@/design-system/dropdown-select';
import {
  useTasks,
  useProjectTasks,
  useHouseholdMembersWithMe,
  useUpdateTaskStatus,
  useUpdateTaskAssignee,
  useDeleteTask,
  taskKeys,
} from './hooks';
import TaskSection from './TaskSection';
import NewTaskDialog from './NewTaskDialog';
import TaskAttachmentsDialog from './TaskAttachmentsDialog';
import TaskDetailDialog from './TaskDetailDialog';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'backlog' | 'done';

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

interface TasksPanelProps {
  projectId?: string;
  stateKeyPrefix?: string;
  /** When provided, the parent owns the New Task dialog state and renders the trigger button itself (e.g. inside a PageHeader). */
  newTaskOpen?: boolean;
  onNewTaskOpenChange?: (open: boolean) => void;
}

export default function TasksPanel({
  projectId,
  stateKeyPrefix,
  newTaskOpen: controlledNewTaskOpen,
  onNewTaskOpenChange,
}: TasksPanelProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const isEmbedded = Boolean(projectId);
  const prefix = stateKeyPrefix ?? 'tasks';

  const isNewTaskControlled = controlledNewTaskOpen !== undefined && onNewTaskOpenChange !== undefined;
  const [internalNewTaskOpen, setInternalNewTaskOpen] = React.useState(false);
  const newTaskOpen = isNewTaskControlled ? controlledNewTaskOpen : internalNewTaskOpen;
  const setNewTaskOpen = React.useCallback(
    (open: boolean) => {
      if (isNewTaskControlled) {
        onNewTaskOpenChange!(open);
      } else {
        setInternalNewTaskOpen(open);
      }
    },
    [isNewTaskControlled, onNewTaskOpenChange],
  );
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [attachmentsTask, setAttachmentsTask] = React.useState<Task | null>(null);
  const [detailTask, setDetailTask] = React.useState<Task | null>(null);
  const [activeFilter, setActiveFilter] = useSessionState<FilterKey>(`${prefix}.filter`, 'all');
  const [showPrivateOnly, setShowPrivateOnly] = useSessionState(`${prefix}.filterPrivate`, false);
  const [filterAssigneeId, setFilterAssigneeId] = useSessionState(`${prefix}.filterAssignee`, '');
  const savedAssigneeFilter = React.useRef('');

  const globalQuery = useTasks();
  const projectQuery = useProjectTasks(projectId ?? '');
  const { data: tasks = [], isLoading, error } = isEmbedded ? projectQuery : globalQuery;

  const { data: householdMembers = [] } = useHouseholdMembersWithMe();
  const updateStatus = useUpdateTaskStatus();
  const updateAssignee = useUpdateTaskAssignee();
  const deleteTaskMutation = useDeleteTask();

  const multipleMembers = householdMembers.length > 1;

  const cacheKey = React.useMemo(
    () => (projectId ? taskKeys.project(projectId) : taskKeys.list()),
    [projectId],
  );

  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      await updateStatus.mutateAsync({ id: taskId, status: newStatus });
    },
    [updateStatus],
  );

  const handleAssigneeChange = React.useCallback(
    async (taskId: string, assignedToId: string | null) => {
      await updateAssignee.mutateAsync({ id: taskId, assignedToId });
    },
    [updateAssignee],
  );

  const handleTaskSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: taskKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('tasks.deleted'),
    onDelete: (id) => deleteTaskMutation.mutateAsync(id),
  });

  const handleTaskDeleted = React.useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      deleteWithUndo(taskId, {
        onRemove: () =>
          qc.setQueryData<Task[]>(cacheKey, (old) => old?.filter((t) => t.id !== taskId)),
        onRestore: () =>
          qc.setQueryData<Task[]>(cacheKey, (old) => (old ? [...old, task] : [task])),
      });
    },
    [tasks, deleteWithUndo, qc, cacheKey],
  );

  const filteredTasks = React.useMemo(() => {
    let result = showPrivateOnly ? tasks.filter((t) => t.is_private) : tasks;
    if (filterAssigneeId === 'unassigned') {
      result = result.filter((t) => !t.assigned_to);
    } else if (filterAssigneeId) {
      result = result.filter((t) => t.assigned_to === filterAssigneeId);
    }
    return result;
  }, [tasks, showPrivateOnly, filterAssigneeId]);

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

  const assigneeFilterOptions = React.useMemo(() => [
    { value: '', label: t('tasks.filterMemberAll') },
    { value: 'unassigned', label: t('tasks.noAssignee') },
    ...householdMembers.map((m) => ({ value: m.userId, label: m.name })),
  ], [householdMembers, t]);

  const assigneeFilterLabel = React.useMemo(() => {
    if (!filterAssigneeId) return t('tasks.filterMember');
    if (filterAssigneeId === 'unassigned') return t('tasks.noAssignee');
    return householdMembers.find((m) => m.userId === filterAssigneeId)?.name ?? t('tasks.filterMember');
  }, [filterAssigneeId, householdMembers, t]);

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
  const isFilteredEmpty = !isLoading && !error && tasks.length > 0
    && Object.values(visibleBySection).every((arr) => arr.length === 0);
  const showSkeleton = useDelayedLoading(isLoading);
  const isInitialLoading = isLoading && !showSkeleton;

  const sectionProps = {
    householdMembers,
    onStatusChange: handleStatusChange,
    onAssigneeChange: handleAssigneeChange,
    onEdit: setEditingTask,
    onDelete: handleTaskDeleted,
    onManageAttachments: setAttachmentsTask,
    onViewDetail: setDetailTask,
  };

  return (
    <>
      <div className="space-y-4">
        {!isNewTaskControlled ? (
          <div className="flex justify-end">
            <Button onClick={() => setNewTaskOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('tasks.new')}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {multipleMembers && (
            <>
              <FilterPill
                active={showPrivateOnly}
                onClick={() => setShowPrivateOnly((v) => {
                  if (!v) {
                    savedAssigneeFilter.current = filterAssigneeId;
                    setFilterAssigneeId('');
                  } else {
                    setFilterAssigneeId(savedAssigneeFilter.current);
                  }
                  return !v;
                })}
              >
                <Lock className="h-3 w-3" />
                {t('tasks.filterPrivate')}
              </FilterPill>
              <span className="h-4 w-px bg-slate-200" />
            </>
          )}

          {FILTERS.map(({ key, label }) => (
            <FilterPill key={key} active={activeFilter === key} onClick={() => setActiveFilter(key)}>
              {label}
            </FilterPill>
          ))}

          {multipleMembers && !showPrivateOnly && (
            <>
              <span className="h-4 w-px bg-slate-200" />
              <DropdownSelect
                value={filterAssigneeId}
                options={assigneeFilterOptions}
                onChange={setFilterAssigneeId}
              >
                <FilterPill active={Boolean(filterAssigneeId)}>
                  <User className="h-3 w-3" />
                  {assigneeFilterLabel}
                </FilterPill>
              </DropdownSelect>
            </>
          )}
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
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : null}

        {isInitialLoading ? <div className="min-h-[280px]" /> : null}

        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{t('tasks.empty')}</p>
            <p className="text-xs text-muted-foreground">{t('tasks.empty_description')}</p>
            <Button variant="outline" size="sm" onClick={() => setNewTaskOpen(true)}>
              {t('tasks.new')}
            </Button>
          </div>
        ) : null}

        {isFilteredEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('tasks.filterEmpty')}</p>
        ) : null}

        {!isLoading && !error && !isEmpty && !isFilteredEmpty ? (
          <div className="space-y-5">
            <TaskSection key="overdue" title={t('tasks.sections.overdue')} tasks={visibleBySection.overdue} highlightHeader {...sectionProps} />
            <TaskSection key="in_progress" title={t('tasks.sections.in_progress')} tasks={visibleBySection.in_progress} {...sectionProps} />
            <TaskSection key="pending" title={t('tasks.sections.pending')} tasks={visibleBySection.pending} {...sectionProps} />
            <TaskSection key="backlog" title={t('tasks.sections.backlog')} tasks={visibleBySection.backlog} {...sectionProps} />
            <TaskSection key="done" title={t('tasks.sections.done')} tasks={visibleBySection.done} {...sectionProps} />
          </div>
        ) : null}
      </div>

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onCreated={handleTaskSaved}
        householdMembers={householdMembers}
        defaultProjectId={projectId}
      />

      <NewTaskDialog
        open={editingTask !== null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreated={handleTaskSaved}
        existingTask={editingTask ?? undefined}
        onUpdated={handleTaskSaved}
        householdMembers={householdMembers}
        defaultProjectId={projectId}
      />

      <TaskAttachmentsDialog
        task={attachmentsTask}
        open={attachmentsTask !== null}
        onOpenChange={(open) => { if (!open) setAttachmentsTask(null); }}
      />

      <TaskDetailDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(open) => { if (!open) setDetailTask(null); }}
        householdMembers={householdMembers}
        onStatusChange={handleStatusChange}
        onAssigneeChange={handleAssigneeChange}
        onEdit={setEditingTask}
        onDelete={handleTaskDeleted}
        onManageAttachments={setAttachmentsTask}
      />
    </>
  );
}
