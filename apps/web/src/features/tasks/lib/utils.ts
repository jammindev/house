import type { Task, TaskColumnId, TaskStatus } from "../types";

export const COLUMN_SEQUENCE: TaskColumnId[] = ["backlog", "pending", "in_progress", "done", "archived"];

export function statusToColumnId(status: TaskStatus): TaskColumnId {
  switch (status) {
    case "pending":
      return "pending";
    case "in_progress":
      return "in_progress";
    case "done":
      return "done";
    case "archived":
      return "archived";
    default:
      return "backlog";
  }
}

export function columnIdToStatus(columnId: TaskColumnId): TaskStatus {
  switch (columnId) {
    case "pending":
      return "pending";
    case "in_progress":
      return "in_progress";
    case "done":
      return "done";
    case "archived":
      return "archived";
    default:
      return null;
  }
}

export function groupTasksByColumn(tasks: Task[]): Record<TaskColumnId, Task[]> {
  const grouped: Record<TaskColumnId, Task[]> = {
    backlog: [],
    pending: [],
    in_progress: [],
    done: [],
    archived: [],
  };

  tasks.forEach((task) => {
    const columnId = statusToColumnId(task.status);
    grouped[columnId].push(task);
  });

  return grouped;
}

export function cloneColumnMap(source: Record<TaskColumnId, Task[]>): Record<TaskColumnId, Task[]> {
  return {
    backlog: [...(source.backlog ?? [])],
    pending: [...(source.pending ?? [])],
    in_progress: [...(source.in_progress ?? [])],
    done: [...(source.done ?? [])],
    archived: [...(source.archived ?? [])],
  };
}

export function flattenColumns(columns: Record<TaskColumnId, Task[]>): Task[] {
  return COLUMN_SEQUENCE.flatMap((columnId) => columns[columnId] ?? []);
}

function clampIndex(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function moveTaskBetweenColumns(
  columns: Record<TaskColumnId, Task[]>,
  taskId: string,
  sourceColumnId: TaskColumnId,
  destinationColumnId: TaskColumnId,
  destinationIndex: number
) {
  const nextColumns = cloneColumnMap(columns);
  const sourceList = nextColumns[sourceColumnId] ?? [];
  const currentIndex = sourceList.findIndex((task) => task.id === taskId);
  if (currentIndex === -1) return null;

  const [task] = sourceList.splice(currentIndex, 1);

  if (destinationColumnId === sourceColumnId) {
    const insertionIndex = clampIndex(destinationIndex, 0, sourceList.length);
    sourceList.splice(insertionIndex, 0, task);
    nextColumns[sourceColumnId] = sourceList;
    return {
      columns: nextColumns,
      movedTask: task,
      statusChanged: false,
    };
  }

  const destinationList = nextColumns[destinationColumnId] ?? [];
  const insertionIndex = clampIndex(destinationIndex, 0, destinationList.length);
  const nextStatus = columnIdToStatus(destinationColumnId);
  const updatedTask: Task = {
    ...task,
    status: nextStatus,
  };

  destinationList.splice(insertionIndex, 0, updatedTask);
  nextColumns[sourceColumnId] = sourceList;
  nextColumns[destinationColumnId] = destinationList;

  return {
    columns: nextColumns,
    movedTask: updatedTask,
    statusChanged: nextStatus !== task.status,
  };
}
