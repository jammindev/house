// nextjs/src/features/interactions/components/InteractionFilters.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { INTERACTION_STATUSES } from "@interactions/constants";
import type { InteractionListFilters, InteractionStatus } from "@interactions/types";

interface InteractionFiltersProps {
  filters: InteractionListFilters;
  onChange: (next: InteractionListFilters) => void;
  onReset?: () => void;
}

export default function InteractionFilters({ filters, onChange, onReset }: InteractionFiltersProps) {
  const { t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const activeStatuses = useMemo(() => new Set(filters.statuses ?? []), [filters.statuses]);

  const handleToggleStatus = (status: InteractionStatus | null) => {
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="h-4 w-4" />
          {t("common.filter")}
        </div>
        <div className="flex flex-wrap items-center text-sm">
          {onReset ? (
            <Button variant="ghost" size="sm" type="button" onClick={onReset} className="text-slate-500">
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            className="text-slate-600"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
      {isCollapsed ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            className="w-full md:w-64"
            placeholder={t("interactions.filters.searchPlaceholder")}
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                search: event.target.value,
              })
            }
          />
          <div className="flex flex-wrap gap-1">
            {INTERACTION_STATUSES.map((status) => {
              const isActive = activeStatuses.has(status);
              return (
                <Button
                  key={status ?? "none"}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleStatus(status)}
                  className={isActive ? "bg-primary-600 hover:bg-primary-700" : "text-slate-600"}
                >
                  {status ? t(`interactionsstatus.${status}`) : t("interactionsstatusNone")}
                </Button>
              );
            })}
          </div>
          <Input
            type="date"
            className="w-full md:w-40"
            aria-label={t("interactions.filters.occurredFromLabel")}
            value={filters.occurredFrom ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                occurredFrom: event.target.value || null,
              })
            }
          />
          <Input
            type="date"
            className="w-full md:w-40"
            aria-label={t("interactions.filters.occurredToLabel")}
            value={filters.occurredTo ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                occurredTo: event.target.value || null,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
