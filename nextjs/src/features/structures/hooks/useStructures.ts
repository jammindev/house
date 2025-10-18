"use client";

import { useCallback, useEffect, useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { CreateStructureInput, Structure } from "../types";

type RawStructure = {
  id: string;
  household_id: string;
  name?: string | null;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeStructure(data: RawStructure): Structure {
  return {
    id: data.id,
    household_id: data.household_id,
    name: normalizeText(data.name) ?? "",
    type: normalizeText(data.type),
    description: normalizeText(data.description),
    website: normalizeText(data.website),
    tags: data.tags ?? [],
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

function sortStructures(list: Structure[]) {
  return [...list].sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
}

export function useStructures() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    setStructures([]);
    try {
      if (!householdId) return;

      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: fetchError } = await client
        .from("structures")
        .select("id, household_id, name, type, description, website, tags, created_at, updated_at")
        .eq("household_id", householdId)
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      const normalized = sortStructures((data ?? []).map((row) => normalizeStructure(row as RawStructure)));
      setStructures(normalized);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("structures.loadFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createStructure = useCallback(
    async (input: CreateStructureInput) => {
      if (!input.householdId) throw new Error(t("structures.householdRequired"));

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error(t("structures.createNoUser"));

        const name = input.name?.trim();
        if (!name) {
          throw new Error(t("structures.nameRequired"));
        }

        const { data: inserted, error: insertError } = await client
          .from("structures")
          .insert({
            household_id: input.householdId,
            name,
            type: input.type?.trim() ?? "",
            description: input.description?.trim() ?? "",
            website: input.website?.trim() ?? "",
            tags: input.tags ?? [],
            created_by: userId,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const structureId = inserted?.id;
        if (!structureId) throw new Error(t("structures.createFailed"));

        const { data: refreshed, error: fetchError } = await client
          .from("structures")
          .select("id, household_id, name, type, description, website, tags, created_at, updated_at")
          .eq("id", structureId)
          .single();

        if (fetchError) throw fetchError;

        const structure = normalizeStructure(refreshed as RawStructure);
        setStructures((prev) => sortStructures([...prev, structure]));
        return structure;
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : t("structures.createFailed");
        throw new Error(message);
      }
    },
    [t]
  );

  return { structures, loading, error, setError, reload, createStructure };
}
