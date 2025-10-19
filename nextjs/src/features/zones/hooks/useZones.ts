// nextjs/src/features/zones/hooks/useZones.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Zone } from "../types";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { Database } from "@/lib/types";

type ZoneRow = Pick<Database["public"]["Tables"]["zones"]["Row"], "id" | "name" | "parent_id" | "created_by" | "note" | "surface">;

const mapZoneRow = (row: ZoneRow): Zone => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by ?? undefined,
    note: row.note,
    surface: row.surface,
});

type CreateZonePayload = {
    household_id: string;
    name: string;
    parent_id?: string | null;
    note?: string | null;
    surface?: number | null;
};

type UpdateZonePayload = Partial<Omit<CreateZonePayload, "household_id">>;

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
            if (!householdId) {
                return;
            }
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: zErr } = await client
                .from("zones")
                .select<ZoneRow>("id,name,parent_id,created_by,note,surface")
                .eq("household_id", householdId)
                .order("created_at");
            if (zErr) throw zErr;
            setZones((data ?? []).map(mapZoneRow));
        } catch (loadError) {
            console.error(loadError);
            const message = loadError instanceof Error ? loadError.message : "Failed to load zones";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        reload();
    }, [reload]);

    const createZone = useCallback(
        async (payload: CreateZonePayload) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: insertError } = await client
                .from("zones")
                .insert(payload)
                .select<ZoneRow>("id,name,parent_id,note,surface,created_by")
                .single();
            if (insertError) throw insertError;
            if (!data) {
                throw new Error("Failed to create zone");
            }
            const zone = mapZoneRow(data);
            setZones((prev) => [...prev, zone]);
            return zone;
        },
        []
    );

    const updateZone = useCallback(
        async (id: string, payload: UpdateZonePayload) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { error: updateError } = await client.from("zones").update(payload).eq("id", id);
            if (updateError) throw updateError;
            setZones((prev) => prev.map((zone) => (zone.id === id ? { ...zone, ...payload } : zone)));
        },
        []
    );

    const deleteZone = useCallback(async (id: string) => {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error: deleteError } = await client.from("zones").delete().eq("id", id);
        if (deleteError) throw deleteError;
        setZones((prev) => prev.filter((zone) => zone.id !== id));
    }, []);

    return { zones, loading, error, setError, reload, createZone, updateZone, deleteZone };
}
