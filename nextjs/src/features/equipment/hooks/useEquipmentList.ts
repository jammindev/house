// nextjs/src/features/equipment/hooks/useEquipmentList.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Equipment, EquipmentFilters } from "../types";
import { DEFAULT_EQUIPMENT_FILTERS } from "../constants";

type RawEquipmentRow = {
  id: string;
  household_id: string;
  zone_id: string | null;
  name: string;
  category: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  purchase_vendor?: string | null;
  warranty_expires_on?: string | null;
  warranty_provider?: string | null;
  warranty_notes?: string | null;
  maintenance_interval_months?: number | null;
  last_service_at?: string | null;
  next_service_due?: string | null;
  status: string;
  condition?: string | null;
  installed_at?: string | null;
  retired_at?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  zone?: { id: string; name?: string | null } | null;
};

const mapRow = (row: RawEquipmentRow): Equipment => ({
  id: row.id,
  household_id: row.household_id,
  zone_id: row.zone_id,
  name: row.name,
  category: row.category ?? "general",
  manufacturer: row.manufacturer ?? null,
  model: row.model ?? null,
  serial_number: row.serial_number ?? null,
  purchase_date: row.purchase_date ?? null,
  purchase_price: row.purchase_price ?? null,
  purchase_vendor: row.purchase_vendor ?? null,
  warranty_expires_on: row.warranty_expires_on ?? null,
  warranty_provider: row.warranty_provider ?? null,
  warranty_notes: row.warranty_notes ?? "",
  maintenance_interval_months: row.maintenance_interval_months ?? null,
  last_service_at: row.last_service_at ?? null,
  next_service_due: row.next_service_due ?? null,
  status: row.status as Equipment["status"],
  condition: row.condition ?? null,
  installed_at: row.installed_at ?? null,
  retired_at: row.retired_at ?? null,
  notes: row.notes ?? "",
  tags: row.tags ?? [],
  created_at: row.created_at,
  updated_at: row.updated_at,
  created_by: row.created_by ?? null,
  updated_by: row.updated_by ?? null,
  zone: row.zone ? { id: row.zone.id, name: row.zone.name ?? "" } : null,
});

export function useEquipmentList(initialFilters: EquipmentFilters = DEFAULT_EQUIPMENT_FILTERS) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();

  const [filters, setFilters] = useState<EquipmentFilters>(initialFilters);
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      let query = client
        .from("equipment")
        .select(
          `
            id,
            household_id,
            zone_id,
            name,
            category,
            manufacturer,
            model,
            serial_number,
            purchase_date,
            purchase_price,
            purchase_vendor,
            warranty_expires_on,
            warranty_provider,
            warranty_notes,
            maintenance_interval_months,
            last_service_at,
            next_service_due,
            status,
            condition,
            installed_at,
            retired_at,
            notes,
            tags,
            created_at,
            updated_at,
            created_by,
            updated_by,
            zone:zones(
              id,
              name
            )
          `
        )
        .eq("household_id", householdId)
        .order("updated_at", { ascending: false });

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      if (filters.zoneId) {
        query = query.eq("zone_id", filters.zoneId);
      }

      if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim();
        query = query.or(
          `name.ilike.%${term}%,manufacturer.ilike.%${term}%,model.ilike.%${term}%,serial_number.ilike.%${term}%`
        );
      }

      const { data, error: loadError } = await query;
      if (loadError) throw loadError;

      setItems((data ?? []).map((row) => mapRow(row as RawEquipmentRow)));
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters, householdId, t]);

  useEffect(() => {
    setItems([]);
    if (!householdId) return;
    void load();
  }, [householdId, load]);

  return {
    items,
    filters,
    setFilters,
    loading,
    error,
    reload: load,
  };
}
