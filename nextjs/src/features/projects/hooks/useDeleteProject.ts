"use client";

import { useCallback } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteProject() {
  return useCallback(async (projectId: string) => {
    const supa = await createSPASassClient();
    const client = supa.getSupabaseClient();

    const { error } = await client.from("projects").delete().eq("id", projectId);
    if (error) throw error;
  }, []);
}

