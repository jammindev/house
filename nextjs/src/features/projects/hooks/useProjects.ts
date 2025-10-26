// nextjs/src/features/projects/hooks/useProjects.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { computeProjectFlags } from "@projects/utils/projectFlags";
import type {
  Project,
  ProjectListFilters,
  ProjectMetrics,
  ProjectStatus,
  ProjectWithMetrics,
} from "@projects/types";

export const DEFAULT_PROJECT_FILTERS: ProjectListFilters = {
  statuses: ["active", "draft"],
};

export function useProjects(initialFilters: ProjectListFilters = DEFAULT_PROJECT_FILTERS) {
  const { t } = useI18n();
  const { selectedHouseholdId: householdId } = useGlobal();
  const [filters, setFilters] = useState<ProjectListFilters>(initialFilters);
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      let query = client
        .from("projects")
        .select(
          `
            id,
            household_id,
            title,
            description,
            status,
            priority,
            start_date,
            due_date,
            closed_at,
            tags,
            planned_budget,
            actual_cost_cached,
            cover_interaction_id,
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("household_id", householdId)
        .order("updated_at", { ascending: false });

      if (filters.statuses && filters.statuses.length) {
        query = query.in("status", filters.statuses as ProjectStatus[]);
      }

      if (filters.search && filters.search.trim().length > 0) {
        const searchTerm = filters.search.trim();
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (filters.startDateFrom) {
        query = query.gte("start_date", filters.startDateFrom);
      }

      if (filters.dueDateTo) {
        query = query.lte("due_date", filters.dueDateTo);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains("tags", filters.tags);
      }

      const { data: projectRows, error: projectError } = await query;
      if (projectError) throw projectError;

      const typedProjects = (projectRows ?? []) as Project[];
      const ids = typedProjects.map((item) => item.id);

      let metricsByProject = new Map<string, ProjectMetrics>();
      if (ids.length) {
        const { data: metricsRows, error: metricsError } = await client
          .from("project_metrics")
          .select("project_id, open_todos, done_todos, documents_count, actual_cost")
          .in("project_id", ids);
        if (metricsError) throw metricsError;
        metricsByProject = new Map(
          (metricsRows ?? []).map((item) => [item.project_id, item as ProjectMetrics])
        );
      }

      const enriched: ProjectWithMetrics[] = typedProjects.map((project) => {
        const metrics = metricsByProject.get(project.id) ?? null;
        const flags = computeProjectFlags(project, metrics);
        return {
          ...project,
          metrics,
          ...flags,
        };
      });

      setProjects(enriched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [filters, householdId, t]);

  useEffect(() => {
    setProjects([]);
    if (!householdId) return;
    void load();
  }, [householdId, load]);

  const activeFilters = useMemo(() => filters, [filters]);

  return {
    projects,
    loading,
    error,
    filters: activeFilters,
    setFilters,
    reload: load,
  };
}
