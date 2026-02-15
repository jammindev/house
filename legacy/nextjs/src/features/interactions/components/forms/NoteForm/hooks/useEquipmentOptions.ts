import { useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { EquipmentOption } from "../types";

export function useEquipmentOptions(householdId: string | null, translate: (key: string) => string) {
    const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
    const [equipmentLoading, setEquipmentLoading] = useState(false);
    const [equipmentError, setEquipmentError] = useState("");

    useEffect(() => {
        if (!householdId) {
            setEquipmentOptions([]);
            return;
        }

        let active = true;
        const loadEquipment = async () => {
            setEquipmentLoading(true);
            setEquipmentError("");
            try {
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();
                const { data, error } = await (client as any)
                    .from("equipment")
                    .select("id, name, status, zone_id")
                    .eq("household_id", householdId)
                    .order("updated_at", { ascending: false })
                    .limit(100);
                if (error) throw error;
                if (!active) return;
                setEquipmentOptions(
                    (data ?? []).map(
                        (row: any) =>
                            ({
                                id: row.id,
                                name: row.name,
                                status: row.status ?? null,
                                zoneId: row.zone_id ?? null,
                            }) satisfies EquipmentOption
                    )
                );
            } catch (err: unknown) {
                if (!active) return;
                const message = err instanceof Error ? err.message : translate("common.unexpectedError");
                setEquipmentError(message);
                setEquipmentOptions([]);
            } finally {
                if (active) setEquipmentLoading(false);
            }
        };

        void loadEquipment();
        return () => {
            active = false;
        };
    }, [householdId, translate]);

    return { equipmentOptions, equipmentLoading, equipmentError };
}
