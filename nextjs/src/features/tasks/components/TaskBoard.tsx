/**
 * TaskBoard component is temporarily commented out while it gets reworked.
 * The previous implementation is preserved below for reference.
 */
/*
"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { UniqueIdentifier } from "@dnd-kit/core";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { TaskColumn } from "./TaskColumn";
import type { Task, TaskColumnConfig, TaskColumnId } from "../types";
import { columnIdToStatus, COLUMN_SEQUENCE, groupTasksByColumn } from "../lib/utils";

const COLUMN_DEFINITIONS: TaskColumnConfig[] = COLUMN_SEQUENCE.map((id) => ({
  id,
  status: columnIdToStatus(id),
}));

type ColumnTasks = Record<TaskColumnId, Task[]>;

type TaskBoardProps = {
  tasks: Task[];
  onMove: (taskId: string, source: TaskColumnId, destination: TaskColumnId, destinationIndex: number) => void;
  loading?: boolean;
};

export function TaskBoard({ tasks, onMove, loading = false }: TaskBoardProps) {
  const { t } = useI18n();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const tasksByColumn = useMemo<ColumnTasks>(() => groupTasksByColumn(tasks), [tasks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeColumn = active.data.current?.columnId as TaskColumnId | undefined;
      let destinationColumn = over.data?.current?.columnId as TaskColumnId | undefined;

      if (!destinationColumn) {
        destinationColumn = resolveColumnIdById(over.id);
      }

      if (!activeColumn || !destinationColumn) return;

      const activeTasks = tasksByColumn[activeColumn] ?? [];
      const destinationTasks = tasksByColumn[destinationColumn] ?? [];

      const activeId = active.id as string;

      if (activeColumn === destinationColumn) {
        const overId = over.data?.current?.type === "task" ? (over.id as string) : null;
        const activeIndex = activeTasks.findIndex((task) => task.id === activeId);
        if (activeIndex === -1) return;
        const overIndex =
          overId && overId !== activeId
            ? activeTasks.findIndex((task) => task.id === overId)
            : destinationTasks.length - 1;
        if (overIndex === -1 || activeIndex === overIndex) return;
        onMove(activeId, activeColumn, destinationColumn, overIndex);
        return;
      }

      const overId = over.data?.current?.type === "task" ? (over.id as string) : null;
      const destinationIndex =
        overId && overId !== activeId
          ? Math.max(
            0,
            destinationTasks.findIndex((task) => task.id === overId)
          )
          : destinationTasks.length;

      onMove(activeId, activeColumn, destinationColumn, destinationIndex);
    },
    [onMove, tasksByColumn]
  );

  const renderColumns = useMemo(
    () =>
      COLUMN_DEFINITIONS.map((column) => (
        <TaskColumn
          key={column.id}
          config={column}
          title={t(`tasks.columns.${column.id}.title`)}
          description={t(`tasks.columns.${column.id}.description`)}
          tasks={tasksByColumn[column.id]}
        />
      )),
    [t, tasksByColumn]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {renderColumns}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}
    </DndContext>
  );
}

function resolveColumnIdById(id: UniqueIdentifier): TaskColumnId | undefined {
  if (typeof id !== "string") return undefined;
  const match = COLUMN_SEQUENCE.find((columnId) => columnId === id);
  return match?.id;
}
*/

export {};
