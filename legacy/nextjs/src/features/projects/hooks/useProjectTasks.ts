"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Interaction, InteractionStatus, InteractionType } from "@interactions/types";
import type { ProjectStatus, ProjectType } from "@projects/types";

const DEFAULT_TASK_TYPES: InteractionType[] = ["task", "todo"];

export interface ProjectTasksData {
    tasks: Interaction[];
    loading: boolean;
    error: string;
    refetch: () => Promise<void>;
}

export type TaskScope = "project" | "household";

export interface UseProjectTasksOptions {
    projectId?: string;
    scope?: TaskScope;
    statuses?: InteractionStatus[];
    types?: InteractionType[];
}

export function useProjectTasks({
    projectId,
    scope = "project",
    statuses,
    types = DEFAULT_TASK_TYPES,
}: UseProjectTasksOptions): ProjectTasksData {
    const { selectedHouseholdId } = useGlobal();
    const [tasks, setTasks] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchTasks = useCallback(async () => {
        if (!selectedHouseholdId) {
            setTasks([]);
            setLoading(false);
            return;
        }

        if (scope === "project" && !projectId) {
            setTasks([]);
            setLoading(false);
            setError("Project ID is required to fetch project tasks");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const query = client
                .from("interactions")
                .select(`
          *,
          project:projects!interactions_project_id_fkey (
            id,
            title,
            status,
            type
          ),
          interaction_tags (
            tag:tags (
              id,
              name
            )
          )
        `)
                .eq("household_id", selectedHouseholdId)
                .in("type", types)
                .order("updated_at", { ascending: false });

            if (scope === "project" && projectId) {
                query.eq("project_id", projectId);
            }

            if (Array.isArray(statuses) && statuses.length > 0) {
                query.in("status", statuses);
            }

            const { data: tasksData, error: tasksError } = await query;

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
                project: raw.project
                    ? {
                        id: raw.project.id,
                        title: raw.project.title ?? "",
                        status: (raw.project.status ?? "draft") as ProjectStatus,
                        type: (raw.project.type ?? null) as ProjectType | null,
                    }
                    : null,
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
    }, [projectId, scope, selectedHouseholdId, statuses, types]);

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
