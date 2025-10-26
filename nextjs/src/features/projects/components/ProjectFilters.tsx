// nextjs/src/features/projects/components/ProjectFilters.tsx
"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import CollapsibleFilterSection from "@/components/CollapsibleFilterSection";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectListFilters, ProjectStatus } from "@projects/types";
import { PROJECT_STATUSES } from "@projects/constants";

interface ProjectFiltersProps {
  filters: ProjectListFilters;
  onChange: (next: ProjectListFilters) => void;
  onReset?: () => void;
}

export default function ProjectFilters({ filters, onChange, onReset }: ProjectFiltersProps) {
  const { t } = useI18n();

  const activeStatuses = useMemo(() => new Set(filters.statuses ?? []), [filters.statuses]);

  const handleToggleStatus = (status: ProjectStatus) => {
    const next = new Set(activeStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onChange({
      ...filters,
      statuses: Array.from(next),
    });
  };

  return (
    <CollapsibleFilterSection
      title={t("projects.filters.title")}
      onReset={onReset}
      resetAriaLabel={t("projects.filters.reset")}
      className="mb-4"
      defaultCollapsed
    >
      <Input
        className="w-full md:w-64"
        placeholder={t("projects.filters.searchPlaceholder")}
        value={filters.search ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            search: event.target.value,
          })
        }
      />
      <div className="flex flex-wrap gap-1">
        {PROJECT_STATUSES.map((status) => {
          const isActive = activeStatuses.has(status);
          return (
            <Button
              key={status}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggleStatus(status)}
              className={isActive ? "bg-primary-600 hover:bg-primary-700" : "text-slate-600"}
            >
              {t(`projects.status.${status}`)}
            </Button>
          );
        })}
      </div>
      <Input
        type="date"
        className="w-full md:w-40"
        value={filters.startDateFrom ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            startDateFrom: event.target.value || null,
          })
        }
      />
      <Input
        type="date"
        className="w-full md:w-40"
        value={filters.dueDateTo ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            dueDateTo: event.target.value || null,
          })
        }
      />
    </CollapsibleFilterSection>
  );
}
