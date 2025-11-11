import type { LucideIcon } from "lucide-react";
import { Notebook } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RepertoireListItemMetadata = {
  label: string;
  variant?: "text" | "badge";
};

export type RepertoireListItemAction = {
  icon: LucideIcon;
  ariaLabel: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

type RepertoireListItemProps = {
  title: string;
  metadata?: RepertoireListItemMetadata[];
  actions?: RepertoireListItemAction[];
  onSelect: () => void;
  detailAriaLabel: string;
  className?: string;
};

export default function RepertoireListItem({
  title,
  metadata = [],
  actions = [],
  onSelect,
  detailAriaLabel,
  className,
}: RepertoireListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar" || e.code === "Space") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex w-full items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-sm font-medium text-gray-900">{title}</div>

          <div className="flex shrink-0 gap-1">
            {actions.map((action, index) => {
              const Icon = action.icon;

              if (action.href) {
                return (
                  <Button
                    key={`action-${index}`}
                    asChild
                    variant="ghost"
                    size="icon"
                    className={cn("hover:bg-primary/10 transition-colors", action.className)}
                  >
                    <a
                      href={action.href}
                      aria-label={action.ariaLabel}
                      onClick={(event) => {
                        event.stopPropagation();
                        action.onClick?.();
                      }}
                    >
                      <Icon className="h-4 w-4 text-gray-600" aria-hidden />
                    </a>
                  </Button>
                );
              }

              return (
                <Button
                  key={`action-${index}`}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("hover:bg-primary/10 transition-colors", action.className)}
                  onClick={(event) => {
                    event.stopPropagation();
                    action.onClick?.();
                  }}
                  aria-label={action.ariaLabel}
                >
                  <Icon className="h-4 w-4 text-gray-600" aria-hidden />
                </Button>
              );
            })}
          </div>
        </div>

        {metadata.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {metadata.map((item, index) =>
              item.variant === "badge" ? (
                <span
                  key={`metadata-badge-${index}`}
                  className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
                >
                  {item.label}
                </span>
              ) : (
                <span key={`metadata-text-${index}`} className="font-medium text-gray-700">
                  {item.label}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
