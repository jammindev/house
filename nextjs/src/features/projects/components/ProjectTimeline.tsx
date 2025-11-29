"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document, Interaction } from "@interactions/types";
import InteractionItem from "@interactions/components/InteractionItem";
import { applyFilters, DEFAULT_PROJECT_FILTERS } from "@projects/lib/interactionFilters";
import { useProjectTimeline } from "@projects/hooks/useProjectTimeline";

interface ProjectTimelineProps {
  projectId: string;
  filterKeys?: string[]; // Optional custom filters
}

export default function ProjectTimeline({
  projectId,
  filterKeys = DEFAULT_PROJECT_FILTERS
}: ProjectTimelineProps) {
  const { t } = useI18n();
  const { interactions, documentsByInteraction, loading, error } = useProjectTimeline(projectId);

  // Apply filters to interactions
  const filteredInteractions = applyFilters(interactions, filterKeys);

  // Create document counts map
  const documentCounts: Record<string, number> = {};
  Object.entries(documentsByInteraction).forEach(([interactionId, docs]) => {
    documentCounts[interactionId] = docs.length;
  });

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.timeline.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-200 p-6 text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!filteredInteractions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.timeline.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-3">
        {filteredInteractions.map((interaction) => (
          <li key={interaction.id}>
            <InteractionItem
              interaction={interaction}
              documentCount={documentCounts[interaction.id] || 0}
              t={t}
              returnTo={`/app/projects/${projectId}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
