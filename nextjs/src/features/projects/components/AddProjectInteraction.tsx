"use client";

import { ChevronRight, FileText, Link2, NotebookPen, Paperclip, Plus, Receipt } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { ZoneOption } from "@interactions/types";
import NewTaskDialog from "@interactions/components/NewTaskDialog";
import NewNoteDialog from "@interactions/components/NewNoteDialog";
import NewQuoteDialog from "@interactions/components/NewQuoteDialog";
import NewSimpleInteractionDialog from "@interactions/components/NewSimpleInteractionDialog";
import NewDocumentDialog from "@interactions/components/NewDocumentDialog";

interface AddProjectInteractionProps {
  projectId: string;
  projectZones?: ZoneOption[];
  className?: string;
  onLinkExisting?: () => void;
  onInteractionCreated?: (interactionId: string) => void;
  showHeader?: boolean;
}

const ICON_VARIANTS = {
  task: "bg-amber-50 text-amber-700",
  note: "bg-sky-50 text-sky-600",
  document: "bg-violet-50 text-violet-700",
  expense: "bg-emerald-50 text-emerald-700",
  call: "bg-indigo-50 text-indigo-700",
  quote: "bg-orange-50 text-orange-700",
  link: "bg-slate-100 text-slate-600",
} as const;

export default function AddProjectInteraction({
  projectId,
  projectZones,
  className,
  onLinkExisting,
  onInteractionCreated,
  showHeader = true,
}: AddProjectInteractionProps) {
  const { t } = useI18n();

  const handleInteractionCreated = (interactionId: string) => {
    onInteractionCreated?.(interactionId);
  };

  const quickActions = [
    {
      key: "task",
      icon: NotebookPen,
      label: t("projects.quickActions.addTask"),
      accent: ICON_VARIANTS.task,
      component: (
        <NewTaskDialog
          projectId={projectId}
          defaultStatus="pending"
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.task
                  )}
                >
                  <NotebookPen className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addTask")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
    {
      key: "note",
      icon: Plus,
      label: t("projects.quickActions.addNote"),
      accent: ICON_VARIANTS.note,
      component: (
        <NewNoteDialog
          projectId={projectId}
          defaultStatus=""
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.note
                  )}
                >
                  <Plus className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addNote")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
    {
      key: "document",
      icon: Paperclip,
      label: t("projects.quickActions.addDocument"),
      accent: ICON_VARIANTS.document,
      component: (
        <NewDocumentDialog
          projectId={projectId}
          defaultStatus=""
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.document
                  )}
                >
                  <Paperclip className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addDocument")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
    {
      key: "expense",
      icon: Receipt,
      label: t("projects.quickActions.addExpense"),
      accent: ICON_VARIANTS.expense,
      component: (
        <NewSimpleInteractionDialog
          projectId={projectId}
          interactionType="expense"
          defaultStatus="done"
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          icon={Receipt}
          label={t("projects.quickActions.addExpense")}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.expense
                  )}
                >
                  <Receipt className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addExpense")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
    {
      key: "call",
      icon: FileText,
      label: t("projects.quickActions.addCall"),
      accent: ICON_VARIANTS.call,
      component: (
        <NewSimpleInteractionDialog
          projectId={projectId}
          interactionType="call"
          defaultStatus="done"
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          icon={FileText}
          label={t("projects.quickActions.addCall")}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.call
                  )}
                >
                  <FileText className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addCall")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
    {
      key: "quote",
      icon: FileText,
      label: t("projects.quickActions.addQuote"),
      accent: ICON_VARIANTS.quote,
      component: (
        <NewQuoteDialog
          projectId={projectId}
          defaultStatus="pending"
          preSelectedZones={projectZones}
          onCreated={handleInteractionCreated}
          trigger={
            <div className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base",
                    ICON_VARIANTS.quote
                  )}
                >
                  <FileText className="h-5 w-5" />
                </span>
                <span>{t("projects.quickActions.addQuote")}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
            </div>
          }
        />
      ),
    },
  ] as const;

  return (
    <div className={cn("space-y-4", className)}>
      {showHeader ? (
        <div className="space-y-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("projects.quickActions.title")}
          </p>
          <p className="text-sm text-slate-500">
            {t("projects.quickActions.subtitle")}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {quickActions.map((action) => (
          <div key={action.key}>
            {action.component}
          </div>
        ))}

        <button
          type="button"
          onClick={() => onLinkExisting?.()}
          className="group flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-base",
                ICON_VARIANTS.link
              )}
            >
              <Link2 className="h-5 w-5" />
            </span>
            {t("projects.quickActions.linkExisting")}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
        </button>
      </div>
    </div>
  );
}
