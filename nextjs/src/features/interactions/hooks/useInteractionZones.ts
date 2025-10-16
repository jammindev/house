"use client";
import { useEffect, useState, useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Zone } from "@/features/zones/types";

export function useInteractionZones(interactionId?: string) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const reload = useCallback(async () => {
    setError("");
    setLoading(true);
    setZones([]);
    try {
      if (!interactionId) return;
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      // First get zone ids linked to this interaction
      const { data: links, error: lErr } = await client
        .from("interaction_zones")
        .select("zone_id")
        .eq("interaction_id", interactionId);
      if (lErr) throw lErr;

      const zoneIds = ((links ?? []) as { zone_id: string }[]).map((l) => l.zone_id).filter(Boolean);
      if (zoneIds.length === 0) {
        setZones([]);
        return;
      }

      const { data, error: zErr } = await client
        .from("zones")
        .select("id,name,parent_id,created_by,note,surface")
        .in("id", zoneIds)
        .order("name" as any);
      if (zErr) throw zErr;
      setZones((data ?? []) as unknown as Zone[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load zones for interaction");
    } finally {
      setLoading(false);
    }
  }, [interactionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateZones = useCallback(
    async (nextZoneIds: string[]) => {
      if (!interactionId) return;
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
        const insertPayload = toAdd.map((zone_id) => ({ interaction_id: interactionId, zone_id }));
        const { error: iErr } = await client.from("interaction_zones").insert(insertPayload);
        if (iErr) throw iErr;
      }

      // 2) deletes
      if (toRemove.length > 0) {
        const { error: dErr } = await client
          .from("interaction_zones")
          .delete()
          .eq("interaction_id", interactionId)
          .in("zone_id", toRemove);
        if (dErr) throw dErr;
      }

      await reload();
    },
    [interactionId, zones, reload]
  );

  return { zones, loading, error, reload, updateZones };
}
