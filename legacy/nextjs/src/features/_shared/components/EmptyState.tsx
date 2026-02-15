"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gray-200 bg-white px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-gray-300" aria-hidden /> : null}
      <div className="space-y-1">
        <h2 className="text-base font-medium text-gray-900">{title}</h2>
        {description ? <p className="text-sm text-gray-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
