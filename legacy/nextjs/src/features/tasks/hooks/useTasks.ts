"use client";

import { useCallback, useEffect, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Task, TaskStatus } from "../types";

export function useTasks() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!householdId) {
        setTasks([]);
        return;
      }
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: queryError } = await client
        .from("interactions")
        .select(
          `
            id,
            household_id,
            subject,
            content,
            status,
            occurred_at,
            created_at,
            updated_at,
            created_by,
            updated_by,
            project_id
          `
        )
        .eq("household_id", householdId)
        .eq("type", "todo")
        .order("status", { ascending: true, nullsFirst: true })
        .order("occurred_at", { ascending: true, nullsFirst: true });
      if (queryError) throw queryError;

      const normalized: Task[] =
        data?.map((row) => ({
          id: row.id as string,
          household_id: row.household_id as string,
          subject: row.subject ?? "",
          content: row.content ?? "",
          status: (row.status ?? null) as TaskStatus,
          occurred_at: row.occurred_at ?? "",
          created_at: row.created_at ?? "",
          updated_at: row.updated_at ?? "",
          created_by: (row.created_by as string | null | undefined) ?? null,
          updated_by: (row.updated_by as string | null | undefined) ?? null,
          project_id: (row.project_id as string | null | undefined) ?? null,
        })) ?? [];

      setTasks(normalized);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("tasks.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      if (!householdId) {
        throw new Error(t("tasks.householdRequired"));
      }
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { error: updateError } = await client
        .from("interactions")
        .update({ status })
        .eq("id", taskId)
        .eq("household_id", householdId)
        .eq("type", "todo");
      if (updateError) throw updateError;
    },
    [householdId, t]
  );

  return {
    tasks,
    setTasks,
    loading,
    error,
    setError,
    reload: fetchTasks,
    updateTaskStatus,
  };
}
