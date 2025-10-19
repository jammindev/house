"use client";

import { useMemo } from "react";
import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="h-4 w-4" />
          {t("projects.filters.title")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {onReset ? (
            <Button variant="ghost" size="sm" type="button" onClick={onReset} className="text-slate-500">
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("projects.filters.reset")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
