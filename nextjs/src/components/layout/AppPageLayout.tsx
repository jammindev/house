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
  /**
   * When true titles/contexts/subtitles are centered. Defaults to true to
   * preserve current visual behaviour. Set to false to left-align titles.
   */
  titlesCentered?: boolean;
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
  titlesCentered = true,
}: AppPageLayoutProps) {
  const { toggleSidebar } = useSidebarToggle();
  const actionButtons = actions?.map((action, i) => {
    if ("element" in action) return <div key={i}>{action.element}</div>;
    return (
      <Button
        key={i}
        variant={action.variant ?? "outline"}
        size={action.size ?? "sm"}
        aria-label={action.label ?? action.href ?? "Action"}
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
          <a href={action.href} aria-label={action.label ?? action.href ?? "Action"}>
            <action.icon className="h-5 w-5" />
            {/* Never show the label visually — keep a screen-reader-only label for accessibility */}
            <span className="sr-only">{action.label ?? action.href ?? "Action"}</span>
          </a>
        ) : (
          <>
            <action.icon className="h-5 w-5" />
            {/* Visually hidden label for screen readers only */}
            <span className="sr-only">{action.label ?? "Action"}</span>
          </>
        )}
      </Button>
    );
  });

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-1 flex-col sm:px-6 sm:py-6 lg:px-8 gap-5",
        className
      )}
    >
      <header>
        {/* Layout header: left fixed, center flexible (min-w-0 + truncate), right fixed */}
        <div className="flex items-center">
          {/* Bouton menu fixe à gauche */}
          <div className="flex items-center flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleSidebar}
              aria-label="Open navigation"
              className="w-fit lg:invisible"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Zone centrale : prend l'espace restant, permet la troncature */}
          <div className="flex-1 min-w-0 px-4">
            <h1
              className={cn(
                "text-2xl font-semibold text-gray-900 truncate",
                titlesCentered ? "text-center" : "text-left"
              )}
              title={title}
            >
              {title}
            </h1>
          </div>

          {/* Boutons d'action fixes à droite */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!hideBackButton && <BackButton />}
            {actionButtons}
          </div>
        </div>
        {subtitle && (
          <p className={cn("max-w-full text-sm text-gray-500 mt-1", titlesCentered ? "text-center" : "text-left")}>
            {subtitle}
          </p>
        )}
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
