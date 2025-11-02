// nextjs/src/features/interactions/components/InteractionFilters.tsx
"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import CollapsibleFilterSection from "@/components/CollapsibleFilterSection";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { INTERACTION_STATUSES, INTERACTION_TYPES, INTERACTION_TYPE_COLORS } from "@interactions/constants";
import type { InteractionListFilters, InteractionStatus, InteractionType } from "@interactions/types";

interface InteractionFiltersProps {
  filters: InteractionListFilters;
  onChange: (next: InteractionListFilters) => void;
  onReset?: () => void;
}

export default function InteractionFilters({ filters, onChange, onReset }: InteractionFiltersProps) {
  const { t } = useI18n();

  const activeTypes = useMemo(() => new Set(filters.types ?? []), [filters.types]);
  const activeStatuses = useMemo(() => new Set(filters.statuses ?? []), [filters.statuses]);

  const handleToggleType = (type: InteractionType) => {
    const next = new Set(activeTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange({
      ...filters,
      types: Array.from(next),
    });
  };

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
    <div className="space-y-3">
      {/* Type filter chips - always visible */}
      <div className="flex flex-wrap gap-2">
        {INTERACTION_TYPES.map((type) => {
          const isActive = activeTypes.has(type);
          const colorClasses = INTERACTION_TYPE_COLORS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleToggleType(type)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 hover:scale-105 ${isActive
                ? colorClasses
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
            >
              {t(`interactionstypes.${type}`)}
            </button>
          );
        })}
      </div>

      {/* Collapsible section for other filters */}
      <CollapsibleFilterSection
        title={t("common.filter")}
        onReset={onReset}
        resetAriaLabel={t("interactions.filters.reset")}
        defaultCollapsed
      >
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
      </CollapsibleFilterSection>
    </div>
  );
}
