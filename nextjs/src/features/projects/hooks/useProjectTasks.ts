"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction } from "@interactions/types";

export interface ProjectTasksData {
    tasks: Interaction[];
    loading: boolean;
    error: string;
    refetch: () => Promise<void>;
}

export function useProjectTasks(projectId: string): ProjectTasksData {
    const { selectedHouseholdId } = useGlobal();
    const [tasks, setTasks] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchTasks = useCallback(async () => {
        if (!projectId || !selectedHouseholdId) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { data: tasksData, error: tasksError } = await client
                .from("interactions")
                .select(`
          *,
          interaction_tags (
            tag:tags (
              id,
              name
            )
          )
        `)
                .eq("household_id", selectedHouseholdId)
                .eq("project_id", projectId)
                .in("type", ["task", "todo"])
                .order("updated_at", { ascending: false });

            if (tasksError) {
                throw new Error(tasksError.message);
            }

            // Transform tasks
            const transformedTasks: Interaction[] = (tasksData || []).map((raw: any) => ({
                id: raw.id,
                household_id: raw.household_id,
                subject: raw.subject,
                content: raw.content,
                type: raw.type,
                status: raw.status,
                occurred_at: raw.occurred_at,
                project_id: raw.project_id,
                metadata: raw.metadata,
                enriched_text: raw.enriched_text,
                created_at: raw.created_at,
                updated_at: raw.updated_at,
                created_by: raw.created_by,
                updated_by: raw.updated_by,
                tags: raw.interaction_tags?.map((it: any) => it.tag).filter((tag: any) => Boolean(tag)) || [],
                contacts: [],
                structures: [],
            }));

            setTasks(transformedTasks);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch project tasks";
            setError(message);
            console.error("useProjectTasks error:", err);
        } finally {
            setLoading(false);
        }
    }, [projectId, selectedHouseholdId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    return {
        tasks,
        loading,
        error,
        refetch: fetchTasks,
    };
}