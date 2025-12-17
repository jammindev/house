// nextjs/src/features/insurance/hooks/useInsuranceContract.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Insurance } from "../types";

export function useInsuranceContract(contractId: string) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();

  const [contract, setContract] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!householdId || !contractId) return;
    setLoading(true);
    setError("");
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data, error: loadError } = await client
        .from("insurance_contracts")
        .select("*")
        .eq("id", contractId)
        .eq("household_id", householdId)
        .single();

      if (loadError) throw loadError;

      setContract(data as Insurance);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [contractId, householdId, t]);

  useEffect(() => {
    setContract(null);
    if (!householdId || !contractId) return;
    void load();
  }, [householdId, contractId, load]);

  return {
    contract,
    loading,
    error,
    reload: load,
  };
}
