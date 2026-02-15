// nextjs/src/features/stock/hooks/useStockItem.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { StockItem, StockItemPayload } from "../types";

export function useStockItem(id?: string) {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [item, setItem] = useState<StockItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        setLoading(true);

        if (!householdId || !id) {
            setItem(null);
            setLoading(false);
            return;
        }

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data, error: loadError } = await client
                .from("stock_items")
                .select(
                    `
          *,
          category:stock_categories!category_id(id, name, color, emoji, description),
          zone:zones!zone_id(id, name)
        `
                )
                .eq("id", id)
                .eq("household_id", householdId)
                .single();

            if (loadError) throw loadError;

            if (!data) {
                setItem(null);
            } else {
                setItem({
                    id: data.id,
                    household_id: data.household_id,
                    category_id: data.category_id,
                    zone_id: data.zone_id,
                    name: data.name,
                    description: data.description ?? "",
                    sku: data.sku ?? "",
                    barcode: data.barcode ?? "",
                    quantity: data.quantity,
                    unit: data.unit,
                    min_quantity: data.min_quantity,
                    max_quantity: data.max_quantity,
                    unit_price: data.unit_price,
                    total_value: data.total_value,
                    purchase_date: data.purchase_date,
                    expiration_date: data.expiration_date,
                    last_restocked_at: data.last_restocked_at,
                    status: data.status as StockItem["status"],
                    supplier: data.supplier ?? "",
                    notes: data.notes ?? "",
                    tags: data.tags ?? [],
                    created_at: data.created_at,
                    updated_at: data.updated_at,
                    created_by: data.created_by,
                    updated_by: data.updated_by,
                    category: data.category
                        ? {
                            id: data.category.id,
                            household_id: data.household_id,
                            name: data.category.name,
                            color: data.category.color ?? "#6366f1",
                            emoji: data.category.emoji ?? "📦",
                            description: data.category.description ?? "",
                            sort_order: 0,
                            created_at: data.created_at,
                            updated_at: data.updated_at,
                            created_by: null,
                            updated_by: null,
                        }
                        : null,
                    zone: data.zone ? { id: data.zone.id, name: data.zone.name ?? "" } : null,
                });
            }
        } catch (err) {
            console.error("Failed to load stock item:", err);
            setError(err instanceof Error ? err.message : "Failed to load item");
        } finally {
            setLoading(false);
        }
    }, [householdId, id]);

    useEffect(() => {
        load();
    }, [load]);

    const updateItem = useCallback(
        async (payload: Partial<StockItemPayload>) => {
            if (!id) throw new Error("No item ID");

            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { error: updateError } = await client
                .from("stock_items")
                .update(payload)
                .eq("id", id);

            if (updateError) throw updateError;
            await load();
        },
        [id, load]
    );

    const deleteItem = useCallback(async () => {
        if (!id) throw new Error("No item ID");

        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error: deleteError } = await client
            .from("stock_items")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;
    }, [id]);

    const adjustQuantity = useCallback(
        async (delta: number) => {
            if (!item) throw new Error("No item loaded");

            const newQuantity = Math.max(0, item.quantity + delta);
            await updateItem({
                quantity: newQuantity,
                last_restocked_at: delta > 0 ? new Date().toISOString() : item.last_restocked_at,
            });
        },
        [item, updateItem]
    );

    return {
        item,
        loading,
        error,
        reload: load,
        updateItem,
        deleteItem,
        adjustQuantity,
    };
}
