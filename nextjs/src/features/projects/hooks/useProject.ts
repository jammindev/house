"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { computeProjectFlags } from "@projects/utils/projectFlags";

export function useProject(projectId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [project, setProject] = useState<ProjectWithMetrics | null>(null);
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
        .eq("id", projectId)
        .eq("household_id", householdId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectRow) {
        setProject(null);
        return;
      }

      const projectData = projectRow as Project;

      const { data: metricsRow, error: metricsError } = await client
        .from("project_metrics")
        .select("project_id, open_todos, done_todos, documents_count, actual_cost")
        .eq("project_id", projectData.id)
        .maybeSingle();
      if (metricsError) throw metricsError;

      const metrics = (metricsRow as ProjectMetrics | null) ?? null;
      const flags = computeProjectFlags(projectData, metrics);

      setProject({
        ...projectData,
        metrics,
        ...flags,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [householdId, projectId, t]);

  useEffect(() => {
    if (!projectId || !householdId) {
      setProject(null);
      return;
    }
    void load();
  }, [householdId, projectId, load]);

  return {
    project,
    loading,
    error,
    reload: load,
  };
}
