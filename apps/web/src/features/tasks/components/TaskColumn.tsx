"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { Task, TaskColumnConfig, TaskColumnId } from "../types";
import { TaskCard } from "./TaskCard";

const COLUMN_ACCENTS: Record<TaskColumnId, string> = {
  backlog: "border-slate-200",
  pending: "border-amber-200",
  in_progress: "border-blue-200",
  done: "border-emerald-200",
  archived: "border-gray-200",
};

type TaskColumnProps = {
  config: TaskColumnConfig;
  title: string;
  description?: string;
  tasks: Task[];
};

export function TaskColumn({ config, title, description, tasks }: TaskColumnProps) {
  const { id } = config;
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "column",
      columnId: id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-[420px] min-w-[260px] flex-shrink-0 flex-col rounded-xl border-2 bg-slate-50/50 p-4 transition-colors",
        COLUMN_ACCENTS[id],
        isOver ? "bg-white shadow-lg" : null
      )}
    >
      <div className="flex items-start justify-between gap-3 pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500 shadow">
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {tasks.length > 0 ? (
            tasks.map((task) => <TaskCard key={task.id} task={task} columnId={id} />)
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/40 p-6 text-center text-xs text-slate-400">
              <span>{t("tasks.dropHere")}</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
