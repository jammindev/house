// nextjs/src/features/projects/hooks/useProjects.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { computeProjectFlags } from "@projects/utils/projectFlags";
import { sortProjectsByPinAndUpdate } from "@projects/utils/sortProjects";
import { usePersistentFilters } from "@shared/hooks/usePersistentFilters";
import type {
  Project,
  ProjectListFilters,
  ProjectMetrics,
  ProjectStatus,
  ProjectWithMetrics,
} from "@projects/types";

export const DEFAULT_PROJECT_FILTERS: ProjectListFilters = {
  statuses: ["active", "draft"],
  projectGroupId: null,
};

export function useProjects(initialFilters: ProjectListFilters = DEFAULT_PROJECT_FILTERS) {
  const { t } = useI18n();
  const { selectedHouseholdId: householdId } = useGlobal();
  const { filters, setFilters, resetFilters } = usePersistentFilters<ProjectListFilters>({
    key: "project-filters",
    fallback: initialFilters,
    scope: householdId,
  });
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
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
            type,
            start_date,
            due_date,
            closed_at,
            tags,
            planned_budget,
            actual_cost_cached,
            cover_interaction_id,
            project_group_id,
            is_pinned,
            project_group:project_groups (
              id,
              name
            ),
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("household_id", householdId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

      if (filters.statuses && filters.statuses.length) {
        query = query.in("status", filters.statuses as ProjectStatus[]);
      }

      if (filters.projectGroupId) {
        query = query.eq("project_group_id", filters.projectGroupId);
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
      const groupIds = Array.from(
        new Set(
          typedProjects
            .map((item) => item.project_group_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      let metricsByProject = new Map<string, ProjectMetrics>();
      if (ids.length) {
        const { data: metricsRows, error: metricsError } = await client
          .from("project_metrics")
          .select("project_id, open_todos, done_todos, documents_count, actual_cost")
          .in("project_id", ids);
        if (metricsError) throw metricsError;
        metricsByProject = new Map(
          (metricsRows ?? [])
            .filter((item) => item.project_id !== null)
            .map((item) => [item.project_id as string, item as ProjectMetrics])
        );
      }

      let groupCountsById = new Map<string, number>();
      if (groupIds.length) {
        const { data: groupMetricsRows, error: groupMetricsError } = await client
          .from("project_group_metrics")
          .select("group_id, projects_count")
          .in("group_id", groupIds);
        if (groupMetricsError) throw groupMetricsError;
        groupCountsById = new Map(
          (groupMetricsRows ?? []).map(
            (item) => [item.group_id as string, (item as { projects_count: number }).projects_count]
          )
        );
      }

      const enriched: ProjectWithMetrics[] = typedProjects.map((project) => {
        const metrics = metricsByProject.get(project.id) ?? null;
        const flags = computeProjectFlags(project, metrics);
        const groupRecord = (project.project_group as { id: string; name: string } | null) ?? null;
        const projectsCount = groupRecord ? groupCountsById.get(groupRecord.id) : undefined;
        const group = groupRecord ? { ...groupRecord, projectsCount } : null;
        return {
          ...project,
          metrics,
          ...flags,
          group,
        };
      });

      setProjects(sortProjectsByPinAndUpdate(enriched));
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
    resetFilters,
    reload: load,
  };
}
