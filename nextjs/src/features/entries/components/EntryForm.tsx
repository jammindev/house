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
        if (!files.length) return;
        setSelectedFiles(prev => {
            const existing = new Set(prev.map(file => `${file.name}:${file.size}:${file.lastModified}`));
            const next = [...prev];
            files.forEach(file => {
                const key = `${file.name}:${file.size}:${file.lastModified}`;
                if (!existing.has(key)) {
                    existing.add(key);
                    next.push(file);
                }
            });
            return next;
        });
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleSubmit = async () => {
        if (!text.trim()) {
            alert(t("entries.rawRequired"));
            return;
        }
        if (!selectedZoneIds.length) {
            alert(t("entries.selectZoneRequired"));
            return;
        }
        setLoading(true);
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { data: userData, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            const userId = userData?.user?.id;
            if (!userId) throw new Error(t("auth.notAuthenticated"));

            // 1) créer l'entrée
            const { data: rpcData, error } = await client
                .rpc("create_entry_with_zones" as any, {
                    p_household_id: householdId,
                    p_raw_text: text.trim(),
                    p_zone_ids: selectedZoneIds,
                });

            if (error) throw error;
            const entryId = rpcData as string | null;
            if (!entryId) throw new Error(t("entries.createFailed"));

            const uploadedPaths: string[] = [];

            try {
                if (selectedFiles.length) {
                    for (const file of selectedFiles) {
                        const safeName = file.name.replace(/[^0-9a-zA-Z._-]/g, "_");
                        const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                            ? crypto.randomUUID()
                            : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                        const storagePath = `${userId}/${entryId}/${uniqueId}_${safeName}`;

                        const { error: uploadError } = await client.storage
                            .from("files")
                            .upload(storagePath, file, {
                                cacheControl: "3600",
                                upsert: false,
                                contentType: file.type || undefined,
                            });
                        if (uploadError) throw uploadError;
                        uploadedPaths.push(storagePath);

                        const { error: linkError } = await client
                            .from("entry_files" as any)
                            .insert({
                                entry_id: entryId,
                                storage_path: storagePath,
                                mime_type: file.type || null,
                                metadata: { size: file.size, name: file.name } as Record<string, unknown>,
                            });
                        if (linkError) throw linkError;
                    }
                }
            } catch (attachmentError) {
                try {
                    if (uploadedPaths.length) {
                        await client.storage.from("files").remove(uploadedPaths);
                    }
                } catch (cleanupError) {
                    console.warn("Failed to cleanup uploaded files", cleanupError);
                }
                try {
                    await client.from("entries" as any).delete().eq("id", entryId);
                } catch (cleanupEntryError) {
                    console.warn("Failed to cleanup entry after attachment error", cleanupEntryError);
                }
                throw attachmentError;
            }

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
                placeholder={t("entries.rawPlaceholder")}
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
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-medium text-gray-600">
                        {t("entries.selectedFiles", { count: selectedFiles.length })}
                    </p>
                    <ul className="space-y-1">
                        {selectedFiles.map((file, index) => (
                            <li
                                key={`${file.name}-${file.lastModified}-${index}`}
                                className="flex items-center justify-between gap-3 text-xs text-gray-700"
                            >
                                <span className="truncate" title={file.name}>
                                    {file.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                                >
                                    {t("common.remove")}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={loading || !text.trim() || selectedZoneIds.length === 0}>
                    {loading ? t("common.saving") : t("common.save")}
                </Button>
                <Button variant="secondary" onClick={() => router.back()} disabled={loading}>
                    {t("common.cancel")}
                </Button>
            </div>
        </div>
    );
}
