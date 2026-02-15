"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import type { PageAction } from "@/components/layout/AppPageLayout";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";
import { cn } from "@/lib/utils";

export type ResourcePageShellProps = {
  title?: string;
  subtitle?: string;
  context?: string;
  hideBackButton?: boolean;
  actions?: PageAction[];
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  loading?: boolean;
  syncLoadingToLayout?: boolean;
  children: ReactNode;
};

/**
 * Synchronises the App layout header with the current resource view and renders the page body.
 */
export default function ResourcePageShell({
  title,
  subtitle,
  context,
  hideBackButton = false,
  actions,
  className,
  contentClassName,
  bodyClassName,
  loading = false,
  syncLoadingToLayout = false,
  children,
}: ResourcePageShellProps) {
  const setLayout = usePageLayoutConfig();
  const layoutLoading = syncLoadingToLayout ? loading : false;

  useEffect(() => {
    setLayout({
      title,
      subtitle,
      context,
      hideBackButton,
      actions,
      className,
      contentClassName,
      loading: layoutLoading,
    });
  }, [
    actions,
    className,
    contentClassName,
    context,
    hideBackButton,
    layoutLoading,
    loading,
    setLayout,
    subtitle,
    title,
  ]);

  return <div className={cn("flex flex-col gap-6", bodyClassName)}>{children}</div>;
}
