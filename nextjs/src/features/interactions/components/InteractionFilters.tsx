// nextjs/src/features/interactions/components/InteractionFilters.tsx
"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import CollapsibleFilterSection from "@/components/CollapsibleFilterSection";
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
  );
}
