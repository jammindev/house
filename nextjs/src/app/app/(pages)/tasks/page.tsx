"use client";

import { useCallback } from "react";
import { ClipboardList } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@shared/components/EmptyState";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { TaskBoard } from "@tasks/components/TaskBoard";
import { useTasks } from "@tasks/hooks/useTasks";
import { flattenColumns, groupTasksByColumn, moveTaskBetweenColumns } from "@tasks/lib/utils";
import type { TaskColumnId } from "@tasks/types";

export default function TasksPage() {
  const { t } = useI18n();
  const { show } = useToast();
  const { tasks, setTasks, loading, error, setError, updateTaskStatus } = useTasks();

  const handleMove = useCallback(
    (taskId: string, sourceColumnId: TaskColumnId, destinationColumnId: TaskColumnId, destinationIndex: number) => {
      setError(null);
      const previousColumns = groupTasksByColumn(tasks);
      const fallbackTasks = flattenColumns(previousColumns);
      const result = moveTaskBetweenColumns(
        previousColumns,
        taskId,
        sourceColumnId,
        destinationColumnId,
        destinationIndex
      );
      if (!result) return;

      const nextTasks = flattenColumns(result.columns);
      setTasks(nextTasks);

      if (!result.statusChanged) return;

      updateTaskStatus(taskId, result.movedTask.status)
        .catch((updateError) => {
          console.error(updateError);
          setTasks(fallbackTasks);
          setError(t("tasks.updateFailed"));
          show({
            title: t("tasks.updateFailed"),
            variant: "destructive",
          });
        });
    },
    [setError, tasks, setTasks, updateTaskStatus, show, t]
  );

  const isEmpty = !loading && tasks.length === 0;

  return (
    <ResourcePageShell title={t("tasks.title")} subtitle={t("tasks.subtitle")} hideBackButton bodyClassName="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={ClipboardList}
          title={t("tasks.emptyTitle")}
          description={t("tasks.emptyDescription")}
        />
      ) : (
        <TaskBoard tasks={tasks} onMove={handleMove} loading={loading} />
      )}
    </ResourcePageShell>
  );
}
