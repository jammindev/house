"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { Check, Circle, X } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction, InteractionStatus } from "@interactions/types";
import { useUpdateInteractionStatus } from "@interactions/hooks/useUpdateInteractionStatus";
import { useProjectTasks } from "@projects/hooks/useProjectTasks";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface ProjectTasksPanelProps {
  projectId: string;
}

type TaskStatusCategory = 'incomplete' | 'complete' | 'cancelled';

const getStatusCategory = (status: InteractionStatus | null): TaskStatusCategory => {
  switch (status) {
    case 'done':
      return 'complete';
    case 'archived':
      return 'cancelled';
    default:
      return 'incomplete';
  }
};

const getNextStatus = (currentStatus: InteractionStatus | null): InteractionStatus => {
  switch (currentStatus) {
    case 'done':
      return 'pending';
    case 'archived':
      return 'pending';
    case 'pending':
    case 'in_progress':
    case null:
    default:
      return 'done';
  }
};

const getBulletIcon = (status: InteractionStatus | null) => {
  switch (status) {
    case 'done':
      return <Check className="h-5 w-5 text-emerald-600" />;
    case 'archived':
      return <X className="h-5 w-5 text-slate-400" />;
    default:
      return <Circle className="h-5 w-5 text-slate-400" />;
  }
};

export default function ProjectTasksPanel({ projectId }: ProjectTasksPanelProps) {
  const { t } = useI18n();
  const { updateStatus, loading: updateLoading } = useUpdateInteractionStatus();
  const { tasks: fetchedTasks, loading, error, refetch } = useProjectTasks(projectId);

  // Local state to manage tasks and see updates immediately
  const [localTasks, setLocalTasks] = useState<Interaction[]>([]);

  // Sync local state with fetched tasks when they change
  useEffect(() => {
    setLocalTasks(fetchedTasks);
  }, [fetchedTasks]);

  const handleToggleTask = useCallback(async (task: Interaction) => {
    const newStatus = getNextStatus(task.status);

    // Update local state immediately for instant feedback
    setLocalTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, updated_at: new Date().toISOString() }
          : t
      )
    );

    try {
      await updateStatus(task.id, newStatus);
      // Refetch from server after successful update
      await refetch();
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert local state on error
      setLocalTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? { ...t, status: task.status, updated_at: task.updated_at }
            : t
        )
      );
    }
  }, [updateStatus, refetch]); const sortedTasks = useMemo(() => {
    const tasksByCategory = localTasks.reduce((acc: Record<TaskStatusCategory, Interaction[]>, task: Interaction) => {
      const category = getStatusCategory(task.status);
      acc[category] = acc[category] || [];
      acc[category].push(task);
      return acc;
    }, {} as Record<TaskStatusCategory, Interaction[]>);

    // Sort within each category by updated_at desc
    Object.values(tasksByCategory).forEach(categoryTasks => {
      categoryTasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });

    return [
      ...(tasksByCategory.incomplete || []),
      ...(tasksByCategory.complete || []),
      ...(tasksByCategory.cancelled || [])
    ];
  }, [localTasks]);

  const totals = useMemo(() => {
    const incomplete = localTasks.filter((task: Interaction) => getStatusCategory(task.status) === 'incomplete').length;
    const complete = localTasks.filter((task: Interaction) => task.status === 'done').length;
    const cancelled = localTasks.filter((task: Interaction) => task.status === 'archived').length;
    return { incomplete, complete, cancelled };
  }, [localTasks]);

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.tasks.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-200 p-6 text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!localTasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.tasks.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5">
          <Circle className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-amber-700">
            {t("projects.tasks.incompleteCount", { count: totals.incomplete })}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5">
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-emerald-700">
            {t("projects.tasks.completeCount", { count: totals.complete })}
          </span>
        </div>
        {totals.cancelled > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
            <X className="h-4 w-4 text-slate-600" />
            <span className="font-medium text-slate-700">
              {t("projects.tasks.cancelledCount", { count: totals.cancelled })}
            </span>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-1">
        {sortedTasks.map((task) => {
          const isDisabled = loading;
          const isComplete = task.status === 'done';
          const isCancelled = task.status === 'archived';

          return (
            <div key={task.id} className="flex items-start gap-3 group">
              {/* Clickable Bullet */}
              <button
                type="button"
                onClick={() => handleToggleTask(task)}
                disabled={isDisabled}
                className={`mt-0.5 p-1 rounded-full transition-colors ${isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-slate-100 cursor-pointer'
                  }`}
                title={isComplete ? t("projects.tasks.markIncomplete") : t("projects.tasks.markComplete")}
              >
                {getBulletIcon(task.status)}
              </button>

              {/* Clickable Task Text */}
              <div className="flex-1 min-w-0">
                <LinkWithOverlay
                  href={`/app/interactions/${task.id}`}
                  className={`block text-sm transition-colors hover:text-slate-900 ${isComplete
                    ? 'text-slate-500 line-through'
                    : isCancelled
                      ? 'text-slate-400 line-through'
                      : 'text-slate-700'
                    }`}
                >
                  <span className="font-medium">{task.subject}</span>
                  {task.content && (
                    <span className="block text-xs text-slate-500 mt-1 truncate">
                      {task.content}
                    </span>
                  )}
                </LinkWithOverlay>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
