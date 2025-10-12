"use client";
import { useEffect, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Entry, EntryFile } from "@entries/types";

export function useEntry(id?: string) {
    const [entry, setEntry] = useState<Entry | null>(null);
    const [files, setFiles] = useState<EntryFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            const { data: eData, error: eErr } = await client
                .from("entries" as any)
                .select("id, raw_text, created_at, household_id")
                .eq("id", id)
                .single();
            if (eErr) throw eErr;
            setEntry(eData as Entry);

            const { data: fData, error: fErr } = await client
                .from("entry_files" as any)
                .select("id, entry_id, storage_path, mime_type, type, metadata")
                .eq("entry_id", id);
            if (fErr) throw fErr;
            setFiles((fData || []) as EntryFile[]);
        } catch (e: any) {
            console.error(e);
            setError(e?.message || "Failed to load entry");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return { entry, files, loading, error, reload: load };
}
