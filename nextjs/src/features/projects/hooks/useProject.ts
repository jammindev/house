// nextjs/src/features/projects/hooks/useProject.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { computeProjectFlags } from "@projects/utils/projectFlags";
import { sortProjectsByPinAndUpdate } from "@projects/utils/sortProjects";

export function useProject(projectId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [project, setProject] = useState<ProjectWithMetrics | null>(null);
  const [relatedProjects, setRelatedProjects] = useState<ProjectWithMetrics[]>([]);
  const [interactionsCount, setInteractionsCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!projectId || !householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: projectRow, error: projectError } = await client
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
            project_zones (
              zone:zones (
                id,
                name,
                parent_id,
                color
              )
            ),
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("id", projectId)
        .eq("household_id", householdId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectRow) {
        setProject(null);
        setRelatedProjects([]);
        return;
      }

      // Transform project data and extract zones
      const rawProject = projectRow as any;
      const zones = rawProject.project_zones?.map((pz: any) => pz.zone) || [];
      const projectData: Project = {
        ...rawProject,
        zones,
        project_zones: undefined, // Remove the raw join data
      };

      const { data: metricsRow, error: metricsError } = await client
        .from("project_metrics")
        .select("project_id, open_todos, done_todos, documents_count, actual_cost")
        .eq("project_id", projectData.id)
        .maybeSingle();
      if (metricsError) throw metricsError;

      const metrics = (metricsRow as ProjectMetrics | null) ?? null;
      const flags = computeProjectFlags(projectData, metrics);

      const groupRecord = (projectData.project_group as { id: string; name: string } | null) ?? null;
      let projectsCount: number | undefined;
      if (projectData.project_group_id) {
        const { data: groupMetricsRow, error: groupMetricsError } = await client
          .from("project_group_metrics")
          .select("group_id, projects_count")
          .eq("group_id", projectData.project_group_id)
          .maybeSingle();
        if (groupMetricsError) throw groupMetricsError;
        projectsCount = groupMetricsRow?.projects_count as number | undefined;
      }
      const group = groupRecord ? { ...groupRecord, projectsCount } : null;

      let related: ProjectWithMetrics[] = [];
      if (projectData.project_group_id) {
        const { data: relatedRows, error: relatedError } = await client
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
              project_zones (
                zone:zones (
                  id,
                  name,
                  parent_id,
                  color
                )
              ),
              created_at,
              updated_at,
              created_by,
              updated_by
            `
          )
          .eq("household_id", householdId)
          .eq("project_group_id", projectData.project_group_id)
          .neq("id", projectData.id)
          .order("updated_at", { ascending: false });
        if (relatedError) throw relatedError;

        const relatedProjectsRaw = (relatedRows ?? []).map((rawRelated: any) => ({
          ...rawRelated,
          zones: rawRelated.project_zones?.map((pz: any) => pz.zone) || [],
          project_zones: undefined, // Remove the raw join data
        })) as Project[];
        const relatedIds = relatedProjectsRaw.map((item) => item.id);

        let relatedMetricsById = new Map<string, ProjectMetrics>();
        if (relatedIds.length) {
          const { data: relatedMetricsRows, error: relatedMetricsError } = await client
            .from("project_metrics")
            .select("project_id, open_todos, done_todos, documents_count, actual_cost")
            .in("project_id", relatedIds);
          if (relatedMetricsError) throw relatedMetricsError;
          relatedMetricsById = new Map(
            (relatedMetricsRows ?? [])
              .filter((item) => item.project_id !== null)
              .map((item) => [item.project_id as string, item as ProjectMetrics])
          );
        }

        related = relatedProjectsRaw.map((relatedProject) => {
          const relatedMetrics = relatedMetricsById.get(relatedProject.id) ?? null;
          const relatedFlags = computeProjectFlags(relatedProject, relatedMetrics);
          const relatedGroupRecord = (relatedProject.project_group as { id: string; name: string } | null) ?? null;
          const relatedGroup = relatedGroupRecord
            ? { ...relatedGroupRecord, projectsCount }
            : null;
          return {
            ...relatedProject,
            metrics: relatedMetrics,
            ...relatedFlags,
            group: relatedGroup,
          };
        });
      }

      setProject({
        ...projectData,
        metrics,
        ...flags,
        group,
      });
      // fetch interactions count for this project (used in some UIs)
      try {
        const { data: _rows, count: interactionsCountResult, error: interactionsCountError } = await client
          .from("interactions")
          .select("id", { count: "exact" })
          .eq("project_id", projectData.id)
          .eq("household_id", householdId);
        if (interactionsCountError) throw interactionsCountError;
        setInteractionsCount(interactionsCountResult ?? 0);
      } catch (err) {
        // non-fatal: log and continue (we still surface the project)
         
        console.warn("Failed to load interactions count for project", projectData.id, err);
        setInteractionsCount(undefined);
      }
      setRelatedProjects(sortProjectsByPinAndUpdate(related));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setProject(null);
      setRelatedProjects([]);
    } finally {
      setLoading(false);
    }
  }, [householdId, projectId, t]);

  useEffect(() => {
    if (!projectId || !householdId) {
      setProject(null);
      setRelatedProjects([]);
      return;
    }
    void load();
  }, [householdId, projectId, load]);

  return {
    project,
    relatedProjects,
    loading,
    error,
    reload: load,
    interactionsCount,
  };
}
