"use client";
import { useMemo, useState } from "react";
import InteractionItem from "./InteractionItem";
import InteractionFilters from "./InteractionFilters";
import { DEFAULT_INTERACTION_FILTERS } from "@interactions/constants";
import type { Interaction, InteractionListFilters } from "@interactions/types";

interface Props {
  interactions: Interaction[];
  documentCounts: Record<string, number>;
  t: (key: string, args?: Record<string, string | number>) => string;
}

const buildDefaultFilters = (): InteractionListFilters => ({
  ...DEFAULT_INTERACTION_FILTERS,
  statuses: [...(DEFAULT_INTERACTION_FILTERS.statuses ?? [])],
});

export default function InteractionList({ interactions, documentCounts, t }: Props) {
  const [filters, setFilters] = useState<InteractionListFilters>(() => buildDefaultFilters());

  const filteredInteractions = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || null;
    const statusFilters = (filters.statuses ?? []).length ? new Set(filters.statuses ?? []) : null;
    const occurredFrom = filters.occurredFrom ?? null;
    const occurredTo = filters.occurredTo ?? null;

    return interactions.filter((interaction) => {
      if (statusFilters && !statusFilters.has(interaction.status ?? null)) {
        return false;
      }

      const occurredDate = interaction.occurred_at.slice(0, 10);
      if (occurredFrom && occurredDate < occurredFrom) {
        return false;
      }
      if (occurredTo && occurredDate > occurredTo) {
        return false;
      }

      if (searchTerm) {
        const haystack = [
          interaction.subject,
          interaction.content,
          interaction.tags.map((tag) => tag.name).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, interactions]);

  const resetFilters = () => setFilters(buildDefaultFilters());

  return (
    <div className="space-y-4">
      <InteractionFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      {filteredInteractions.length === 0 ? (
        <div className="text-sm text-gray-500">{t("interactionsnone")}</div>
      ) : (
        <ul className="space-y-3">
          {filteredInteractions.map((interaction) => (
            <li key={interaction.id}>
              <InteractionItem
                interaction={interaction}
                documentCount={documentCounts[interaction.id] || 0}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
