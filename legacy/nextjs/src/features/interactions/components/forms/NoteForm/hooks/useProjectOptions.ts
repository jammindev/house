import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ProjectOption } from "../types";

export function useProjectOptions(householdId: string | null, translate: (key: string) => string) {
    const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState("");

    useEffect(() => {
        if (!householdId) {
            setProjectOptions([]);
            return;
        }

        let active = true;
        const loadProjects = async () => {
            setProjectLoading(true);
            setProjectError("");
            try {
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();
                const { data, error: loadError } = await (client as any)
                    .from("projects")
                    .select("id, title, status, project_zones(zone_id)")
                    .eq("household_id", householdId)
                    .order("updated_at", { ascending: false })
                    .limit(100);
                if (loadError) throw loadError;
                if (!active) return;
                setProjectOptions(
                    (data ?? []).map((row: any) => ({
                        id: row.id,
                        title: row.title,
                        status: row.status,
                        zoneIds: Array.isArray(row.project_zones) ? row.project_zones.map((pz: any) => pz.zone_id) : [],
                    }))
                );
            } catch (err: unknown) {
                if (!active) return;
                const message = err instanceof Error ? err.message : translate("common.unexpectedError");
                setProjectError(message);
                setProjectOptions([]);
            } finally {
                if (active) setProjectLoading(false);
            }
        };

        void loadProjects();
        return () => {
            active = false;
        };
    }, [householdId, translate]);

    return { projectOptions, projectLoading, projectError };
}
