"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageAction = {
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
  action?: PageAction;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function AppPageLayout({
  title,
  subtitle,
  context,
  action,
  children,
  className,
  contentClassName,
}: AppPageLayoutProps) {
  const actionButton = action ? (
    <Button
      variant={action.variant ?? "ghost"}
      size={action.size ?? "icon"}
      aria-label={action.label}
      disabled={action.disabled}
      onClick={action.href ? undefined : action.onClick}
      className={cn(
        "relative shrink-0",
        action.size === "icon" ? "p-2" : "gap-2",
        action.className
      )}
    >
      <action.icon className="h-5 w-5" />
      {action.label &&
        <span className={cn(action.size === "icon" ? "sr-only" : "text-sm font-medium")}>{action.label}</span>
      }
    </Button>
  ) : null;

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8", className)}>
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            {title}
            {context ? <span className="text-gray-500"> · {context}</span> : null}
          </h1>
          {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {action
          ? action.href && !action.disabled
            ? (
              <Link href={action.href} className="self-end sm:self-auto">
                {actionButton}
              </Link>
            )
            : (
              <div className="self-end sm:self-auto">{actionButton}</div>
            )
          : null}
      </header>
      <div className={cn("flex-1", contentClassName)}>{children}</div>
    </div>
  );
}
