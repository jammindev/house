"use client";

import type { ReactNode } from "react";
import type { PageAction } from "@/components/layout/AppPageLayout";
import ResourcePageShell from "./ResourcePageShell";
import ListSkeleton from "../components/ListSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type ListPageLayoutProps = {
  title: string;
  subtitle?: string;
  context?: string;
  hideBackButton?: boolean;
  actions?: PageAction[];
  toolbar?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  showSkeleton?: boolean;
  isEmpty?: boolean;
  emptyState?: ReactNode;
  error?: string | null;
  errorTitle?: string;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  syncLayoutLoading?: boolean;
};

/**
 * Generic list layout that wires the app header, optional toolbar and content states (empty, loading, error).
 */
export default function ListPageLayout({
  title,
  subtitle,
  context,
  hideBackButton,
  actions,
  toolbar,
  children,
  loading = false,
  showSkeleton = true,
  isEmpty = false,
  emptyState,
  error,
  errorTitle,
  className,
  contentClassName,
  bodyClassName,
  syncLayoutLoading = false,
}: ListPageLayoutProps) {
  return (
    <ResourcePageShell
      title={title}
      subtitle={subtitle}
      context={context}
      hideBackButton={hideBackButton}
      actions={actions}
      className={className}
      contentClassName={contentClassName}
      bodyClassName={bodyClassName}
      loading={loading}
      syncLoadingToLayout={syncLayoutLoading}
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{errorTitle ?? title}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {toolbar}

        {loading ? (
          showSkeleton ? <ListSkeleton /> : null
        ) : isEmpty ? (
          emptyState
        ) : (
          children
        )}
      </div>
    </ResourcePageShell>
  );
}
