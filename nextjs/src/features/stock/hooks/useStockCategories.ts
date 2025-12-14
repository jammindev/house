// nextjs/src/features/stock/hooks/useStockCategories.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { StockCategory, StockCategoryPayload } from "../types";

export function useStockCategories() {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [categories, setCategories] = useState<StockCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        setLoading(true);

        if (!householdId) {
            setCategories([]);
            setLoading(false);
            return;
        }

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: loadError } = await client
                .from("stock_categories")
                .select("*")
                .eq("household_id", householdId)
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });

            if (loadError) throw loadError;

            setCategories(
                (data ?? []).map((row) => ({
                    id: row.id,
                    household_id: row.household_id,
                    name: row.name,
                    color: row.color ?? "#6366f1",
                    emoji: row.emoji ?? "📦",
                    description: row.description ?? "",
                    sort_order: row.sort_order ?? 0,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    created_by: row.created_by ?? null,
                    updated_by: row.updated_by ?? null,
                }))
            );
        } catch (err) {
            console.error("Failed to load stock categories:", err);
            setError(err instanceof Error ? err.message : "Failed to load categories");
        } finally {
            setLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        load();
    }, [load]);

    const createCategory = useCallback(
        async (payload: Omit<StockCategoryPayload, "household_id">) => {
            if (!householdId) throw new Error("No household selected");

            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: insertError } = await client
                .from("stock_categories")
                .insert({ ...payload, household_id: householdId })
                .select()
                .single();

            if (insertError) throw insertError;
            await load();
            return data;
        },
        [householdId, load]
    );

    const updateCategory = useCallback(
        async (id: string, payload: Partial<StockCategoryPayload>) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { error: updateError } = await client
                .from("stock_categories")
                .update(payload)
                .eq("id", id);

            if (updateError) throw updateError;
            await load();
        },
        [load]
    );

    const deleteCategory = useCallback(
        async (id: string) => {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { error: deleteError } = await client
                .from("stock_categories")
                .delete()
                .eq("id", id);

            if (deleteError) throw deleteError;
            await load();
        },
        [load]
    );

    return {
        categories,
        loading,
        error,
        reload: load,
        createCategory,
        updateCategory,
        deleteCategory,
    };
}
