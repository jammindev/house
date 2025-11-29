// nextjs/src/components/layout/CollapsibleSectionToggle.tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

type CollapsibleSectionToggleProps = {
  isCollapsed: boolean;
  onToggle: () => void;
  detailsId: string;
  label: ReactNode | ((state: { isCollapsed: boolean }) => ReactNode);
  collapsedLabel: string;
  expandedLabel: string;
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
  chevronClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

export default function CollapsibleSectionToggle({
  isCollapsed,
  onToggle,
  detailsId,
  label,
  collapsedLabel,
  expandedLabel,
  icon,
  className,
  labelClassName,
  chevronClassName,
  onClick,
  ...rest
}: CollapsibleSectionToggleProps) {
  const renderedLabel = typeof label === "function" ? label({ isCollapsed }) : label;

  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    onToggle();
  };

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      aria-expanded={!isCollapsed}
      aria-controls={detailsId}
      aria-label={isCollapsed ? collapsedLabel : expandedLabel}
      title={isCollapsed ? collapsedLabel : expandedLabel}
      onClick={handleClick}
      {...rest}
    >
      <span className={cn("flex items-center gap-2", labelClassName)}>
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        <span>{renderedLabel}</span>
      </span>
      <span className={cn("text-slate-700", chevronClassName)}>
        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </span>
    </button>
  );
}
