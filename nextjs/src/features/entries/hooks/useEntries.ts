"use client";
import { useEffect, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Entry, EntryFile } from "@entries/types";

export function useEntries(householdId?: string | null) {
    const { t } = useI18n();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [filesByEntry, setFilesByEntry] = useState<Record<string, EntryFile[]>>({});
    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            setError("");
            setLoading(true);
            setEntries([]);
            setFilesByEntry({});
            try {
                if (!householdId) return;
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();
                const { data: eData, error: eErr } = await client
                    .from("entries" as any)
                    .select("id, raw_text, created_at, household_id")
                    .eq("household_id", householdId)
                    .order("created_at" as any, { ascending: false })
                    .limit(50);
                if (eErr) throw eErr;
                const list = (eData || []) as Entry[];
                setEntries(list);

                const ids = list.map((e) => e.id);
                if (ids.length > 0) {
                    const { data: fData, error: fErr } = await client
                        .from("entry_files" as any)
                        .select("id, entry_id, storage_path, mime_type, type")
                        .in("entry_id", ids);
                    if (fErr) throw fErr;
                    const grouped: Record<string, EntryFile[]> = {};
                    (fData || []).forEach((f: any) => {
                        const arr = grouped[f.entry_id] || [];
                        arr.push(f as EntryFile);
                        grouped[f.entry_id] = arr;
                    });
                    setFilesByEntry(grouped);
                    const counts: Record<string, number> = {};
                    Object.keys(grouped).forEach((k) => (counts[k] = grouped[k].length));
                    setFileCounts(counts);
                }
            } catch (e: any) {
                console.error(e);
                setError(e?.message || t("entries.listLoadFailed"));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [householdId]);
    return { entries, filesByEntry, fileCounts, loading, error, setError };
}
