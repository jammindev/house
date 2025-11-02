"use client";

import { useCallback } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteProjectGroup() {
  return useCallback(async (groupId: string) => {
    const supa = await createSPASassClient();
    const client = supa.getSupabaseClient();

    const { error } = await client.from("project_groups").delete().eq("id", groupId);
    if (error) throw error;
  }, []);
}

