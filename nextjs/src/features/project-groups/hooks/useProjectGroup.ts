"use client";

import { useCallback, useEffect, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ProjectGroup, ProjectGroupMetrics, ProjectGroupWithMetrics } from "@project-groups/types";
import { computeProjectGroupSnapshot } from "@project-groups/utils/projectGroupStats";

export function useProjectGroup(groupId?: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [group, setGroup] = useState<ProjectGroupWithMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    if (!groupId || !householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: groupRow, error: groupError } = await client
        .from("project_groups")
        .select(
          `
            id,
            household_id,
            name,
            description,
            tags,
            is_private,
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("id", groupId)
        .eq("household_id", householdId)
        .maybeSingle();

      if (groupError) throw groupError;
      if (!groupRow) {
        setGroup(null);
        return;
      }

      const groupData = groupRow as ProjectGroup;

      const { data: metricsRow, error: metricsError } = await client
        .from("project_group_metrics")
        .select("group_id, projects_count, planned_budget, actual_cost, open_todos, done_todos, documents_count")
        .eq("group_id", groupData.id)
        .maybeSingle();

      if (metricsError) throw metricsError;

      const metrics = (metricsRow as ProjectGroupMetrics | null) ?? null;
      setGroup(computeProjectGroupSnapshot(groupData, metrics));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, householdId, t]);

  useEffect(() => {
    if (!groupId || !householdId) {
      setGroup(null);
      return;
    }
    void load();
  }, [groupId, householdId, load]);

  return {
    group,
    loading,
    error,
    reload: load,
  };
}
