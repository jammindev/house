"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import UserAuditInfo from "@/components/UserAuditInfo";

type AuditUser = {
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type AuditLine = 
  | string
  | {
      prefix: string;
      user: AuditUser | null;
      suffix?: string;
      fallbackText?: string;
    };

type AuditHistoryCardProps = {
  lines?: AuditLine[];
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
          {lines.map((line, index) => {
            // Support legacy string format
            if (typeof line === "string") {
              return <p key={index}>{line}</p>;
            }
            
            // New format with user object
            return (
              <p key={index} className="flex items-center gap-1">
                <span>{line.prefix}</span>
                {line.user ? (
                  <UserAuditInfo
                    username={line.user.username}
                    email={line.user.email}
                    avatarUrl={line.user.avatar_url}
                    fallbackText={line.fallbackText}
                  />
                ) : (
                  <span>{line.fallbackText ?? "Unknown User"}</span>
                )}
                {line.suffix && <span>{line.suffix}</span>}
              </p>
            );
          })}
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
