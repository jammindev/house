"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type AuditHistoryCardProps = {
  lines?: string[];
  loading?: boolean;
  actions?: ReactNode;
  className?: string;
};

export default function AuditHistoryCard({ lines = [], loading = false, actions, className }: AuditHistoryCardProps) {
  const hasLines = !loading && lines.length > 0;
  const shouldRender = loading || hasLines || Boolean(actions);

  if (!shouldRender) return null;

  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors",
        className
      )}
    >
      {hasLines && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      )}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
      {actions ? <div className="mt-1">{actions}</div> : null}
    </section>
  );
}
