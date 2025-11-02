"use client";

import { useCallback } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

export function useDeleteContact() {
  return useCallback(async (contactId: string) => {
    const supa = await createSPASassClient();
    const client = supa.getSupabaseClient();

    const { error } = await client.from("contacts").delete().eq("id", contactId);
    if (error) throw error;
  }, []);
}
