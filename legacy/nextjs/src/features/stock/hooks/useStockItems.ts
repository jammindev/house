// nextjs/src/features/stock/hooks/useStockItems.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { StockItem, StockFilters, StockItemPayload } from "../types";
import { DEFAULT_STOCK_FILTERS } from "../constants";

type RawStockItemRow = {
    id: string;
    household_id: string;
    category_id: string;
    zone_id: string | null;
    name: string;
    description: string | null;
    sku: string | null;
    barcode: string | null;
    quantity: number;
    unit: string;
    min_quantity: number | null;
    max_quantity: number | null;
    unit_price: number | null;
    total_value: number | null;
    purchase_date: string | null;
    expiration_date: string | null;
    last_restocked_at: string | null;
    status: string;
    supplier: string | null;
    notes: string | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
    category?: {
        id: string;
        name: string;
        color: string;
        emoji: string;
    } | null;
    zone?: {
        id: string;
        name: string | null;
    } | null;
};

const mapRow = (row: RawStockItemRow): StockItem => ({
    id: row.id,
    household_id: row.household_id,
    category_id: row.category_id,
    zone_id: row.zone_id,
    name: row.name,
    description: row.description ?? "",
    sku: row.sku ?? "",
    barcode: row.barcode ?? "",
    quantity: row.quantity,
    unit: row.unit,
    min_quantity: row.min_quantity,
    max_quantity: row.max_quantity,
    unit_price: row.unit_price,
    total_value: row.total_value,
    purchase_date: row.purchase_date,
    expiration_date: row.expiration_date,
    last_restocked_at: row.last_restocked_at,
    status: row.status as StockItem["status"],
    supplier: row.supplier ?? "",
    notes: row.notes ?? "",
    tags: row.tags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    category: row.category
        ? {
            id: row.category.id,
            household_id: row.household_id,
            name: row.category.name,
            color: row.category.color ?? "#6366f1",
            emoji: row.category.emoji ?? "📦",
            description: "",
            sort_order: 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: null,
            updated_by: null,
        }
        : null,
    zone: row.zone ? { id: row.zone.id, name: row.zone.name ?? "" } : null,
});

export function useStockItems() {
    const { selectedHouseholdId: householdId } = useGlobal();
    const [items, setItems] = useState<StockItem[]>([]);
    const [filters, setFilters] = useState<StockFilters>(DEFAULT_STOCK_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        setLoading(true);

        if (!householdId) {
            setItems([]);
            setLoading(false);
            return;
        }

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            let query = client
                .from("stock_items")
                .select(
                    `
          *,
          category:stock_categories!category_id(id, name, color, emoji),
          zone:zones!zone_id(id, name)
        `
                )
                .eq("household_id", householdId);

            // Apply filters
            if (filters.categoryId) {
                query = query.eq("category_id", filters.categoryId);
            }
            if (filters.zoneId) {
                query = query.eq("zone_id", filters.zoneId);
            }
            if (filters.statuses && filters.statuses.length > 0) {
                query = query.in("status", filters.statuses);
            }
            if (filters.search) {
                query = query.ilike("name", `%${filters.search}%`);
            }

            query = query.order("name", { ascending: true });

            const { data, error: loadError } = await query;

            if (loadError) throw loadError;

            setItems((data ?? []).map((row) => mapRow(row as RawStockItemRow)));
        } catch (err) {
            console.error("Failed to load stock items:", err);
            setError(err instanceof Error ? err.message : "Failed to load stock items");
        } finally {
            setLoading(false);
        }
    }, [householdId, filters]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        items,
        filters,
        setFilters,
        loading,
        error,
        reload: load,
    };
}
