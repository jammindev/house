"use client";

import { useMemo } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { Task, TaskColumnId } from "../types";

const STATUS_BADGE_VARIANT: Record<TaskColumnId, string> = {
  backlog: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  archived: "bg-gray-200 text-gray-600",
};

type TaskCardProps = {
  task: Task;
  columnId: TaskColumnId;
};

export function TaskCard({ task, columnId }: TaskCardProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: "task",
      columnId,
    },
  });

  const formattedDate = useMemo(() => {
    if (!task.occurred_at) return null;
    const date = new Date(task.occurred_at);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }, [task.occurred_at]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab space-y-2 border border-slate-200 p-4 shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        isDragging ? "rotate-1 border-primary-500 shadow-lg" : "hover:shadow-md"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-900">{task.subject || t("tasks.untitledTask")}</h3>
        <Badge className={cn("text-xs font-medium uppercase tracking-wide", STATUS_BADGE_VARIANT[columnId])}>
          {t(`tasks.statusLabels.${columnId}`)}
        </Badge>
      </div>
      {task.content ? (
        <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{task.content}</p>
      ) : null}
      <div className="flex justify-between text-[11px] text-slate-500">
        {formattedDate ? <span>{formattedDate}</span> : <span>{t("tasks.noDate")}</span>}
        {task.project_id ? <span>{t("tasks.linkedProject")}</span> : null}
      </div>
    </Card>
  );
}
