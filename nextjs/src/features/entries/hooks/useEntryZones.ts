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

  const updateZones = useCallback(
    async (nextZoneIds: string[]) => {
      if (!entryId) return;
      const currentIds = new Set(zones.map((z) => z.id));
      const nextIds = new Set(nextZoneIds);

      const toAdd: string[] = [];
      const toRemove: string[] = [];

      // compute adds
      nextIds.forEach((id) => {
        if (!currentIds.has(id)) toAdd.push(id);
      });
      // compute removes
      currentIds.forEach((id) => {
        if (!nextIds.has(id)) toRemove.push(id);
      });

      if (toAdd.length === 0 && toRemove.length === 0) return; // nothing to do

      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // run mutations
      // 1) inserts
      if (toAdd.length > 0) {
        const insertPayload = toAdd.map((zone_id) => ({ entry_id: entryId, zone_id }));
        const { error: iErr } = await client.from("entry_zones" as any).insert(insertPayload);
        if (iErr) throw iErr;
      }

      // 2) deletes
      if (toRemove.length > 0) {
        const { error: dErr } = await client
          .from("entry_zones" as any)
          .delete()
          .eq("entry_id", entryId)
          .in("zone_id", toRemove);
        if (dErr) throw dErr;
      }

      await reload();
    },
    [entryId, zones, reload]
  );

  return { zones, loading, error, reload, updateZones };
}
