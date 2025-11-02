// nextjs/src/features/zones/hooks/useZones.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { Database } from "@/lib/types";
import type { Zone } from "../types";
import { DEFAULT_FIRST_LEVEL_COLOR, ROOT_ZONE_COLOR, lightenHexColor, normalizeHexColor } from "@zones/lib/colors";

type ZoneRow = Pick<Database["public"]["Tables"]["zones"]["Row"], "id" | "name" | "parent_id" | "created_by" | "note" | "surface" | "color">;

const mapZoneRow = (row: ZoneRow): Zone => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by ?? undefined,
    note: row.note,
    surface: row.surface,
    color: row.color ?? ROOT_ZONE_COLOR,
});

type CreateZonePayload = {
    household_id: string;
    name: string;
    parent_id?: string | null;
    note?: string | null;
    surface?: number | null;
    color?: string | null;
};

type UpdateZonePayload = Partial<Omit<CreateZonePayload, "household_id">>;

function resolveColorForZone({
    zone,
    parentZone,
    requestedColor,
}: {
    zone?: Zone | null;
    parentZone: Zone | null;
    requestedColor?: string | null;
}) {
    if (!parentZone) {
        return ROOT_ZONE_COLOR;
    }
    if (!parentZone.parent_id) {
        const base = requestedColor ?? zone?.color ?? DEFAULT_FIRST_LEVEL_COLOR;
        return normalizeHexColor(base, DEFAULT_FIRST_LEVEL_COLOR);
    }
    const parentColor = parentZone.color ?? DEFAULT_FIRST_LEVEL_COLOR;
    return lightenHexColor(parentColor);
}

function buildChildrenMap(zones: Zone[]) {
    const map = new Map<string, Zone[]>();
    zones.forEach((zone) => {
        if (!zone.parent_id) return;
        const list = map.get(zone.parent_id) ?? [];
        list.push(zone);
        map.set(zone.parent_id, list);
    });
    return map;
}

export function useZones() {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [zonesState, setZonesState] = useState<Zone[]>([]);
    const zonesRef = useRef<Zone[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    const setZones = useCallback((updater: Zone[] | ((prev: Zone[]) => Zone[])) => {
        setZonesState((prev) => {
            const next = typeof updater === "function" ? (updater as (prev: Zone[]) => Zone[])(prev) : updater;
            zonesRef.current = next;
            return next;
        });
    }, []);

    const zones = zonesState;

    const cascadeChildColors = useCallback(
        async (client: SupabaseClient<Database>, parentZone: Zone, snapshot: Zone[]) => {
            if (!parentZone.parent_id) return;
            const childMap = buildChildrenMap(snapshot);
            const pendingUpdates: Array<{ id: string; color: string }> = [];

            const visit = async (current: Zone) => {
                const children = childMap.get(current.id) ?? [];
                for (const child of children) {
                    const nextColor = lightenHexColor(current.color);
                    const { error: updateError } = await client.from("zones").update({ color: nextColor }).eq("id", child.id);
                    if (updateError) throw updateError;
                    const updatedChild: Zone = { ...child, color: nextColor };
                    pendingUpdates.push({ id: child.id, color: nextColor });
                    await visit(updatedChild);
                }
            };

            await visit(parentZone);
            if (pendingUpdates.length === 0) return;
            const colorMap = new Map(pendingUpdates.map((item) => [item.id, item.color] as const));
            setZones((prev) =>
                prev.map((zone) => (colorMap.has(zone.id) ? { ...zone, color: colorMap.get(zone.id)! } : zone))
            );
        },
        [setZones]
    );

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
                .select<ZoneRow>("id,name,parent_id,created_by,note,surface,color")
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
    }, [householdId, setZones]);

    useEffect(() => {
        reload();
    }, [reload]);

    const createZone = useCallback(
        async (payload: CreateZonePayload) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const parentZone = payload.parent_id ? zonesRef.current.find((z) => z.id === payload.parent_id) ?? null : null;
            if (payload.parent_id && !parentZone) {
                throw new Error("Selected parent zone no longer exists.");
            }
            if (parentZone && !parentZone.parent_id && !payload.color) {
                throw new Error("Color is required for first-level zones.");
            }
            const resolvedColor = resolveColorForZone({
                zone: null,
                parentZone,
                requestedColor: payload.color ?? null,
            });
            const insertPayload = { ...payload, color: resolvedColor };
            const { data, error: insertError } = await client
                .from("zones")
                .insert(insertPayload)
                .select<ZoneRow>("id,name,parent_id,note,surface,created_by,color")
                .single();
            if (insertError) throw insertError;
            if (!data) {
                throw new Error("Failed to create zone");
            }
            const zone = mapZoneRow(data);
            setZones((prev) => [...prev, zone]);
            return zone;
        },
        [setZones]
    );

    const updateZone = useCallback(
        async (id: string, payload: UpdateZonePayload) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const existing = zonesRef.current.find((zone) => zone.id === id);
            if (!existing) {
                throw new Error("Zone not found");
            }

            const nextParentId = payload.parent_id !== undefined ? payload.parent_id : existing.parent_id ?? null;
            const parentZone = nextParentId ? zonesRef.current.find((z) => z.id === nextParentId) ?? null : null;
            if (nextParentId && !parentZone) {
                throw new Error("Selected parent zone no longer exists.");
            }

            const currentParent = existing.parent_id ? zonesRef.current.find((z) => z.id === existing.parent_id) ?? null : null;
            const wasFirstLevel = !!(currentParent && !currentParent.parent_id);
            const becomesFirstLevel = !!(parentZone && !parentZone.parent_id);
            if (becomesFirstLevel && !payload.color && !wasFirstLevel) {
                throw new Error("Color is required for first-level zones.");
            }

            const resolvedColor = resolveColorForZone({
                zone: existing,
                parentZone,
                requestedColor: payload.color ?? existing.color,
            });

            const updatePayload = { ...payload, color: resolvedColor };
            const { error: updateError } = await client.from("zones").update(updatePayload).eq("id", id);
            if (updateError) throw updateError;

            const updatedZone: Zone = {
                ...existing,
                ...payload,
                color: resolvedColor,
                parent_id: nextParentId,
            };

            const snapshot = zonesRef.current.map((zone) => (zone.id === id ? updatedZone : zone));
            setZones(snapshot);

            if (updatedZone.parent_id) {
                await cascadeChildColors(client, updatedZone, snapshot);
            }
        },
        [cascadeChildColors, setZones]
    );

    const deleteZone = useCallback(async (id: string) => {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error: deleteError } = await client.from("zones").delete().eq("id", id);
        if (deleteError) throw deleteError;
        setZones((prev) => prev.filter((zone) => zone.id !== id));
    }, [setZones]);

    return { zones, loading, error, setError, reload, createZone, updateZone, deleteZone };
}
