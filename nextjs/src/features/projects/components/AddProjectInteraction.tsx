"use client";

import { ChevronRight, FileText, Link2, NotebookPen, Paperclip, Plus, Receipt } from "lucide-react";

import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface AddProjectInteractionProps {
  projectId: string;
  className?: string;
  onLinkExisting?: () => void;
  showHeader?: boolean;
}

const ICON_VARIANTS = {
  task: "bg-amber-50 text-amber-700",
  note: "bg-sky-50 text-sky-600",
  document: "bg-violet-50 text-violet-700",
  expense: "bg-emerald-50 text-emerald-700",
  call: "bg-indigo-50 text-indigo-700",
  link: "bg-slate-100 text-slate-600",
} as const;

export default function AddProjectInteraction({
  projectId,
  className,
  onLinkExisting,
  showHeader = true,
}: AddProjectInteractionProps) {
  const { t } = useI18n();
  const projectPagePath = `/app/projects/${projectId}`;

  const buildInteractionUrl = (basePath: string, extraParams: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({
      projectId,
      returnTo: projectPagePath,
    });
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return `${basePath}?${params.toString()}`;
  };

  const quickActions = [
    {
      key: "task",
      icon: NotebookPen,
      label: t("projects.quickActions.addTask"),
      href: buildInteractionUrl("/app/interactions/new/todo"),
      accent: ICON_VARIANTS.task,
    },
    {
      key: "note",
      icon: Plus,
      label: t("projects.quickActions.addNote"),
      href: buildInteractionUrl("/app/interactions/new/note"),
      accent: ICON_VARIANTS.note,
    },
    {
      key: "document",
      icon: Paperclip,
      label: t("projects.quickActions.addDocument"),
      href: buildInteractionUrl("/app/interactions/new", { type: "document" }),
      accent: ICON_VARIANTS.document,
    },
    {
      key: "expense",
      icon: Receipt,
      label: t("projects.quickActions.addExpense"),
      href: buildInteractionUrl("/app/interactions/new/expense"),
      accent: ICON_VARIANTS.expense,
    },
    {
      key: "call",
      icon: FileText,
      label: t("projects.quickActions.addCall"),
      href: buildInteractionUrl("/app/interactions/new/call"),
      accent: ICON_VARIANTS.call,
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
          <LinkWithOverlay
            key={action.key}
            href={action.href}
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-base",
                  action.accent
                )}
              >
                <action.icon className="h-5 w-5" />
              </span>
              <span>{action.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-primary-500" />
          </LinkWithOverlay>
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
