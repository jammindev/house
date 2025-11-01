// nextjs/src/components/layout/AppPageLayout.tsx
"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BackButton from "../BackButton";
import { useSidebarToggle } from "./SidebarToggleContext";

export type PageAction =
  | { element: ReactNode }
  | {
    label?: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
  };

interface AppPageLayoutProps {
  title: string;
  subtitle?: string;
  context?: string;
  actions?: PageAction[];
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hideBackButton?: boolean;
  loading?: boolean;
}

export default function AppPageLayout({
  title,
  subtitle,
  context,
  actions,
  children,
  className,
  contentClassName,
  hideBackButton = false,
  loading = false,
}: AppPageLayoutProps) {
  const { toggleSidebar } = useSidebarToggle();
  const actionButtons = actions?.map((action, i) => {
    if ("element" in action) return <div key={i}>{action.element}</div>;
    return (
      <Button
        key={i}
        variant={action.variant ?? "outline"}
        size={action.size ?? "sm"}
        aria-label={action.label}
        disabled={action.disabled}
        onClick={action.href ? undefined : action.onClick}
        className={cn(
          "relative shrink-0",
          action.size === "icon" ? "p-2" : "gap-2",
          action.className
        )}
        asChild={!!action.href}
      >
        {action.href ? (
          <a href={action.href}>
            <action.icon className="h-5 w-5" />
            {action.label && (
              <span
                className={cn(
                  action.size === "icon" ? "sr-only" : "text-sm font-medium"
                )}
              >
                {action.label}
              </span>
            )}
          </a>
        ) : (
          <>
            <action.icon className="h-5 w-5" />
            {action.label && (
              <span
                className={cn(
                  action.size === "icon" ? "sr-only" : "text-sm font-medium"
                )}
              >
                {action.label}
              </span>
            )}
          </>
        )}
      </Button>
    );
  });

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-1 flex-col sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="sticky top-0 z-10 bg-transparent flex w-full items-start justify-between pt-2 pb-2">
        <Button
          size="sm"
          variant="outline"
          onClick={toggleSidebar}
          aria-label="Open navigation"
          className="w-fit lg:invisible"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex self-end space-x-2"> {!hideBackButton && <BackButton />}
          {actionButtons}</div>
      </div>

      <header className="space-y-2 w-full pt-2 pb-3">
        <div className="space-y-1 ml-2 lg:ml-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {title}
          </h1>
          {context ? <span className="text-gray-500">{context}</span> : null}
          {subtitle && (
            <p className="max-w-sm text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </header>

      {/* 💡 Ajout d’un loader global */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
        </div>
      ) : (
        <div className={cn("flex-1", contentClassName)}>{children}</div>
      )}
    </div>
  );
}
