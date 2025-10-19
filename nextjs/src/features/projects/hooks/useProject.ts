"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";
import { useGlobal } from "@/lib/context/GlobalContext";

const computeFlags = (project: Project, metrics: ProjectMetrics | null) => {
  const base: Pick<ProjectWithMetrics, "isDueSoon" | "isOverdue"> = {
    isDueSoon: false,
    isOverdue: false,
  };
  if (!project.due_date || project.status === "completed" || project.status === "cancelled") {
    return base;
  }

  const due = new Date(project.due_date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const openTodos = metrics?.open_todos ?? 0;

  const diffMs = due.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return {
    isOverdue: due < today && openTodos > 0,
    isDueSoon: diffDays >= 0 && diffDays <= 7 && openTodos > 0,
  };
};

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
      const flags = computeFlags(projectData, metrics);

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
