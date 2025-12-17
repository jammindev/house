// nextjs/src/features/insurance/hooks/useInsurance.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Insurance, InsuranceFilters } from "../types";
import { DEFAULT_INSURANCE_FILTERS } from "../constants";

export function useInsurance(initialFilters: InsuranceFilters = DEFAULT_INSURANCE_FILTERS) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();

  const [filters, setFilters] = useState<InsuranceFilters>(initialFilters);
  const [contracts, setContracts] = useState<Insurance[]>([]);
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
        .from("insurance_contracts")
        .select("*")
        .eq("household_id", householdId)
        .order("updated_at", { ascending: false });

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      if (filters.types && filters.types.length > 0) {
        query = query.in("type", filters.types);
      }

      if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim();
        query = query.or(
          `name.ilike.%${term}%,provider.ilike.%${term}%,contract_number.ilike.%${term}%,insured_item.ilike.%${term}%`
        );
      }

      const { data, error: loadError } = await query;
      if (loadError) throw loadError;

      setContracts((data ?? []) as Insurance[]);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, householdId, t]);

  useEffect(() => {
    setContracts([]);
    if (!householdId) return;
    void load();
  }, [householdId, load]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_INSURANCE_FILTERS);
  }, []);

  return {
    contracts,
    filters,
    setFilters,
    resetFilters,
    loading,
    error,
    reload: load,
  };
}
