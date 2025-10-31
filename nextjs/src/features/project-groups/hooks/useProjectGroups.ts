"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { CreateProjectGroupInput, ProjectGroup, ProjectGroupMetrics, ProjectGroupWithMetrics } from "@project-groups/types";
import { computeProjectGroupSnapshot } from "@project-groups/utils/projectGroupStats";

export function useProjectGroups() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [groups, setGroups] = useState<ProjectGroupWithMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: groupRows, error: groupsError } = await client
        .from("project_groups")
        .select(
          `
            id,
            household_id,
            name,
            description,
            tags,
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("household_id", householdId)
        .order("updated_at", { ascending: false });

      if (groupsError) throw groupsError;

      const typedGroups = (groupRows ?? []) as ProjectGroup[];
      const ids = typedGroups.map((group) => group.id);

      let metricsByGroup = new Map<string, ProjectGroupMetrics>();
      if (ids.length) {
        const { data: metricsRows, error: metricsError } = await client
          .from("project_group_metrics")
          .select("group_id, projects_count, planned_budget, actual_cost, open_todos, done_todos, documents_count")
          .in("group_id", ids);

        if (metricsError) throw metricsError;

        metricsByGroup = new Map(
          (metricsRows ?? []).map((item) => [item.group_id, item as ProjectGroupMetrics])
        );
      }

      const enriched = typedGroups.map((group) => {
        const metrics = metricsByGroup.get(group.id) ?? null;
        return computeProjectGroupSnapshot(group, metrics);
      });

      setGroups(enriched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    setGroups([]);
    if (!householdId) return;
    void load();
  }, [householdId, load]);

  const memoizedGroups = useMemo(() => groups, [groups]);

  return {
    groups: memoizedGroups,
    loading,
    error,
    reload: load,
    createProjectGroup: useCallback(
      async (input: CreateProjectGroupInput): Promise<ProjectGroupWithMetrics> => {
        const name = (input.name ?? "").trim();
        if (!input.householdId) throw new Error(t("projectGroups.householdRequired"));
        if (!name) throw new Error(t("projectGroups.nameRequired"));

        const description = (input.description ?? "").trim();
        const tags = (input.tags ?? []).map((x) => x.trim()).filter(Boolean);

        try {
          const supa = await createSPASassClient();
          const client = supa.getSupabaseClient();

          const { data: inserted, error: insertError } = await client
            .from("project_groups")
            .insert({
              household_id: input.householdId,
              name,
              description,
              tags,
            })
            .select("id")
            .single();
          if (insertError) throw insertError;
          const newId = inserted?.id as string | undefined;
          if (!newId) throw new Error(t("projectGroups.createFailed"));

          const { data: groupRow, error: groupError } = await client
            .from("project_groups")
            .select(
              `
              id,
              household_id,
              name,
              description,
              tags,
              created_at,
              updated_at,
              created_by,
              updated_by
            `,
            )
            .eq("id", newId)
            .maybeSingle();
          if (groupError) throw groupError;
          if (!groupRow) throw new Error(t("projectGroups.createFailed"));

          const base = groupRow as ProjectGroup;

          const { data: metricsRow, error: metricsError } = await client
            .from("project_group_metrics")
            .select("group_id, projects_count, planned_budget, actual_cost, open_todos, done_todos, documents_count")
            .eq("group_id", newId)
            .maybeSingle();
          if (metricsError) throw metricsError;
          const metrics = (metricsRow as ProjectGroupMetrics | null) ?? null;

          const snapshot = computeProjectGroupSnapshot(base, metrics);
          setGroups((prev) => [snapshot, ...prev]);
          return snapshot;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t("projectGroups.createFailed");
          throw new Error(message);
        }
      },
      [t],
    ),
  };
}
