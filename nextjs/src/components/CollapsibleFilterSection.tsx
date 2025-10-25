// nextjs/src/components/CollapsibleFilterSection.tsx
"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleFilterSectionProps {
  title: string;
  children: ReactNode;
  onReset?: () => void;
  resetAriaLabel?: string;
  defaultCollapsed?: boolean;
  className?: string;
  contentClassName?: string;
}

export default function CollapsibleFilterSection({
  title,
  children,
  onReset,
  resetAriaLabel,
  defaultCollapsed = false,
  className,
  contentClassName,
}: CollapsibleFilterSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex gap-2 md:items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="h-4 w-4" />
          {title}
        </div>
        <div className="flex flex-wrap items-center text-sm">
          {onReset ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onReset}
              className="text-slate-500"
              aria-label={resetAriaLabel}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            className="text-slate-600"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {isCollapsed ? null : (
        <div className={cn("mt-4 flex flex-wrap items-center gap-2", contentClassName)}>{children}</div>
      )}
    </div>
  );
}
