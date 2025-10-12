"use client";
import { useEffect, useState, useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Zone } from "@/features/zones/types";

export function useEntryZones(entryId?: string) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    setZones([]);
    try {
      if (!entryId) return;
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // First get zone ids linked to this entry
      const { data: links, error: lErr } = await client
        .from("entry_zones" as any)
        .select("zone_id")
        .eq("entry_id", entryId);
      if (lErr) throw lErr;

      const zoneIds = (links || []).map((l: any) => l.zone_id).filter(Boolean);
      if (zoneIds.length === 0) {
        setZones([]);
        return;
      }

      const { data, error: zErr } = await client
        .from("zones" as any)
        .select("id,name,parent_id,created_by,note,surface")
        .in("id", zoneIds)
        .order("name" as any);
      if (zErr) throw zErr;
      setZones((data as Zone[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load zones for entry");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { zones, loading, error, reload };
}

