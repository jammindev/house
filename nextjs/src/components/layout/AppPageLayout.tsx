// nextjs/src/components/layout/AppPageLayout.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BackButton, { pushToBackHistory } from "../BackButton";
import { useSidebarToggle } from "./SidebarToggleContext";
import { Card } from "../ui/card";
import { Spinner } from "../ui/spinner";

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
  const pathname = usePathname();
  const [scrollOpacity, setScrollOpacity] = useState(1);

  useEffect(() => {
    pushToBackHistory(pathname);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      // Calculer l'opacité basée sur le scroll (disparaît sur les premiers 50px)
      const scrollY = window.scrollY;
      const maxScroll = 25;
      const opacity = Math.max(0, 1 - scrollY / maxScroll);
      setScrollOpacity(opacity);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const actionButtons = actions?.map((action, i) => {
    if ("element" in action) return <div key={i}>{action.element}</div>;
    return (
      <Button
        key={i}
        variant={action.variant ?? "outline"}
        size={action.size ?? "icon"}
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
        "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5",
        className
      )}
    >
<Card
  className={cn(
    "sticky top-4 z-20 p-3 transition-all duration-300",
    "glass-panel"
  )}
  style={{
    backgroundColor: `rgba(255, 255, 255, ${scrollOpacity * 0.8})`,
    backdropFilter: scrollOpacity > 0.1 ? "blur(8px)" : "none",
    borderColor: `rgba(229, 231, 235, ${scrollOpacity})`,
    boxShadow: scrollOpacity > 0.1 
      ? `0 1px 3px 0 rgba(0, 0, 0, ${0.1 * scrollOpacity}), 0 1px 2px -1px rgba(0, 0, 0, ${0.1 * scrollOpacity})`
      : "none",
  }}
>
        <header
        >
          {/* Header uses grid to keep side buttons fixed while the title truncates */}
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2 sm:gap-4">
            {/* Bouton menu fixe à gauche */}
            <div className="flex items-center flex-shrink-0">
              <Button
                size="icon"
                variant="outline"
                onClick={toggleSidebar}
                aria-label="Open navigation"
                className="lg:invisible"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            {/* Zone centrale : prend l'espace restant, permet la troncature */}
            <div 
              className="min-w-0 px-2 sm:px-4 transition-opacity duration-300"
              style={{ opacity: scrollOpacity }}
            >
              <h1
                className={cn(
                  "text-lg md:text-2xl font-semibold text-gray-900 truncate",
                  titlesCentered ? "text-center" : "text-left"
                )}
                title={title}
              >
                {title}
              </h1>
            </div>

            {/* Boutons d'action fixes à droite */}
            <div className="flex items-center gap-2 flex-shrink-0 justify-end">
              {!hideBackButton && <BackButton />}
              {actionButtons}
            </div>
          </div>
          {subtitle && (
            <p 
              className={cn(
                "max-w-full text-sm text-gray-500 mt-1 transition-opacity duration-300", 
                titlesCentered ? "text-center" : "text-left"
              )}
              style={{ opacity: scrollOpacity }}
            >
              {subtitle}
            </p>
          )}
        </header>
      </Card>

      {/* 💡 Ajout d’un loader global */}
      {
        loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className={cn("flex-1", contentClassName)}>{children}</div>
        )
      }
    </div >
  );
}
