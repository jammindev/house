// nextjs/src/features/zones/hooks/useZones.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Zone } from "../types";
import { useGlobal } from "@/lib/context/GlobalContext";

export function useZones() {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    const reload = useCallback(async () => {
        setError("");
        setLoading(true);
        setZones([]);
        try {
            if (!householdId) return;
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: zErr } = await client
                .from("zones")
                .select("id,name,parent_id,created_by,note,surface")
                .eq("household_id", householdId)
                .order("created_at" as any);
            if (zErr) throw zErr;
            setZones((data ?? []) as unknown as Zone[]);
        } catch (e: any) {
            console.error(e);
            setError(e?.message || "Failed to load zones");
        } finally {
            setLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        reload();
    }, [reload]);

    const createZone = useCallback(
        async (payload: Omit<Zone, "id" | "created_by"> & { household_id: string }) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error } = await client
                .from("zones")
                .insert(payload)
                .select("id,name,parent_id,note,surface,created_by")
                .single();
            if (error) throw error;
            const zone = data as unknown as Zone;
            setZones((prev) => [...prev, zone]);
            return zone;
        },
        []
    );

    const updateZone = useCallback(
        async (id: string, payload: Partial<Omit<Zone, "id" | "created_by">>) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { error } = await client.from("zones").update(payload).eq("id", id);
            if (error) throw error;
            setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...payload } as Zone : z)));
        },
        []
    );

    const deleteZone = useCallback(async (id: string) => {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error } = await client.from("zones").delete().eq("id", id);
        if (error) throw error;
        setZones((prev) => prev.filter((z) => z.id !== id));
    }, []);

    return { zones, loading, error, setError, reload, createZone, updateZone, deleteZone };
}
