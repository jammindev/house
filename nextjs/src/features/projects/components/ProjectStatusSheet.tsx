// nextjs/src/features/projects/components/ProjectStatusSheet.tsx
"use client";

import { Check } from "lucide-react";

import CountBadge from "@/components/ui/CountBadge";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_COLORS } from "@projects/constants";
import type { ProjectStatus } from "@projects/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface ProjectStatusSheetProps {
  status: ProjectStatus;
  options: ProjectStatus[];
  disabled?: boolean;
  onSelect: (status: ProjectStatus) => Promise<void> | void;
  className?: string;
}

export default function ProjectStatusSheet({
  status,
  options,
  disabled,
  onSelect,
  className,
}: ProjectStatusSheetProps) {
  const { t } = useI18n()
  const trigger = (
    <CountBadge
      label={t(`projects.status.${status}`)}
      display="inline"
      tone="none"
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
        }
      }}
      className={cn(
        PROJECT_STATUS_COLORS[status],
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50"
      )}
    />
  );

  return (
    <div className={cn("inline-flex", className)}>
      <SheetDialog
        trigger={trigger}
        title={t("projects.fields.status")}
        description={t("projects.status.changeHint")}
        closeLabel={t("common.close")}
      >
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const isActive = option === status;

            return (
              <button
                key={option}
                type="button"
                disabled={disabled || isActive}
                onClick={() => {
                  void onSelect(option);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  isActive
                    ? "border-slate-200 bg-slate-50 font-semibold"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                  disabled && !isActive && "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold",
                    PROJECT_STATUS_COLORS[option]
                  )}
                >
                  {t(`projects.status.${option}`)}
                </span>
                {isActive ? <Check className="h-4 w-4 text-primary-600" /> : null}
              </button>
            );
          })}
        </div>
      </SheetDialog>
    </div>
  );
}
