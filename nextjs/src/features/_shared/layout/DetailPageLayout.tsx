"use client";

import type { ReactNode } from "react";
import type { PageAction } from "@/components/layout/AppPageLayout";
import ResourcePageShell from "./ResourcePageShell";
import DetailSkeleton from "../components/DetailSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type DetailPageLayoutProps = {
  title: string;
  subtitle?: string;
  context?: string;
  hideBackButton?: boolean;
  actions?: PageAction[];
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  isNotFound?: boolean;
  notFoundState?: ReactNode;
  aside?: ReactNode;
  errorTitle?: string;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  syncLayoutLoading?: boolean;
};

/**
 * Shared detail layout to present a resource summary with optional side content.
 */
export default function DetailPageLayout({
  title,
  subtitle,
  context,
  hideBackButton,
  actions,
  children,
  loading = false,
  error,
  isNotFound = false,
  notFoundState,
  aside,
  errorTitle,
  className,
  contentClassName,
  bodyClassName,
  syncLayoutLoading = false,
}: DetailPageLayoutProps) {
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

        {loading ? (
          <DetailSkeleton />
        ) : isNotFound ? (
          notFoundState ?? null
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex-1">{children}</div>
            {aside ? <div className="w-full lg:w-80">{aside}</div> : null}
          </div>
        )}
      </div>
    </ResourcePageShell>
  );
}
