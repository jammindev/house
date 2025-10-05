"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import DocumentImportButtons from "@entries/components/DocumentImportButtons";
import ZonePicker from "@entries/components/ZonePicker";
import type { ZoneOption } from "@entries/types";

interface Props {
    householdId: string;
    t: (key: string, args?: Record<string, any>) => string;
    zones: ZoneOption[];              // ✅ nécessaire pour le picker multi
    loadingZones?: boolean;
}

export default function EntryForm({ householdId, t, zones, loadingZones }: Props) {
    const router = useRouter();
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]); // ✅ multi
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const handleFilesSelected = (files: File[]) => {
        setSelectedFiles(prev => [...prev, ...files]);
    };

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            // 1) créer l'entrée
            const { data, error } = await client
                .from("entries")
                .insert({
                    household_id: householdId,
                    raw_text: text,
                })
                .select("id")
                .single();

            if (error) throw error;
            const entryId = data?.id as string;

            // 2) lier les zones sélectionnées (si table pivot `entry_zones`)
            // if (selectedZoneIds.length) {
            //   const { error: ezErr } = await client
            //     .from("entry_zones")
            //     .insert(selectedZoneIds.map(zone_id => ({ entry_id: entryId, zone_id })));
            //   if (ezErr) throw ezErr;
            // }

            // 3) uploader les fichiers vers Storage + créer `entry_files`
            // if (selectedFiles.length) { ... }

            router.push("/app/entries?created=1");
        } catch (e: any) {
            console.error(e);
            alert(t("entries.createFailed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={t("entries.placeholder")}
                rows={6}
            />

            {/* Zones */}
            {loadingZones ? (
                <div className="text-sm text-gray-500">{t("zones.loading")}</div>
            ) : (
                <ZonePicker zones={zones} value={selectedZoneIds} onChange={setSelectedZoneIds} />
            )}

            {/* Fichiers */}
            <DocumentImportButtons onFilesSelected={handleFilesSelected} />

            {selectedFiles.length > 0 && (
                <div className="text-xs text-gray-600">
                    {t("entries.selectedFiles", { count: selectedFiles.length })}
                </div>
            )}

            <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={loading || !text.trim()}>
                    {loading ? t("common.saving") : t("common.save")}
                </Button>
                <Button variant="secondary" onClick={() => router.back()} disabled={loading}>
                    {t("common.cancel")}
                </Button>
            </div>
        </div>
    );
}
