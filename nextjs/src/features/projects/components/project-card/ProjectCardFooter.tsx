// nextjs/src/features/projects/components/project-card/ProjectCardFooter.tsx
"use client";

import type { ProjectTypeDefinition } from "@projects/constants";
import { CardFooter } from "@/components/ui/card";
import CollapsibleSectionToggle from "@/components/layout/CollapsibleSectionToggle";
import { cn } from "@/lib/utils";
import { formatDate } from "@projects/utils/projectCard";

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectCardFooterProps {
  isCollapsed: boolean;
  typeMeta: ProjectTypeDefinition;
  detailsId: string;
  locale: string;
  updatedAt: string | null;
  createdAt: string;
  t: Translate;
  onToggle: () => void;
}

export default function ProjectCardFooter({
  isCollapsed,
  typeMeta,
  detailsId,
  locale,
  updatedAt,
  createdAt,
  t,
  onToggle,
}: ProjectCardFooterProps) {
  const toggleLabel = t("projects.updatedAt", {
    date: formatDate(updatedAt ?? createdAt, locale),
  });

  return (
    <CardFooter className="p-0">
      <CollapsibleSectionToggle
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        detailsId={detailsId}
        collapsedLabel={t("projects.actions.showDetails")}
        expandedLabel={t("projects.actions.hideDetails")}
        label={toggleLabel}
        className={cn("rounded-b-lg border-t", typeMeta.accent.footerBg, typeMeta.accent.footerBorder)}
      />
    </CardFooter>
  );
}
