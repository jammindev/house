// nextjs/src/components/layout/AppPageLayout.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BackButton from "../BackButton";


type PageAction =
  | {
    /** ✅ Élément React libre (ex: <InteractionAttachmentImport />) */
    element: ReactNode;
  }
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
}: AppPageLayoutProps) {
  const actionButtons = actions?.map((action, i) => {
    if ("element" in action) {
      return <div key={i}>{action.element}</div>;
    }
    return (
      <Button
        key={i}
        variant={action.variant ?? "default"}
        size={action.size ?? "icon"}
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
                  action.size === "icon"
                    ? "sr-only"
                    : "text-sm font-medium"
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
                  action.size === "icon"
                    ? "sr-only"
                    : "text-sm font-medium"
                )}
              >
                {action.label}
              </span>
            )}
          </>
        )}
      </Button>)
  });

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl flex-1 flex-col sm:px-6 sm:py-6 lg:px-8", className)}>
      <header className="mb-4 flex flex-row justify-between items-center w-full">
        <div className="flex gap-2 items-center">
          {!hideBackButton && <BackButton />}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              {title}
              {context ? <span className="text-gray-500"> · {context}</span> : null}
            </h1>
            {subtitle ? <p className="text-sm text-gray-500 max-w-sm">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">{actionButtons}</div>

      </header>
      <div className={cn("flex-1", contentClassName)}>{children}</div>
    </div>
  );
}
