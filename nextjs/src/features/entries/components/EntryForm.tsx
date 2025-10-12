// nextjs/src/features/entries/components/EntryForm.tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import DocumentImportButtons from "@entries/components/DocumentImportButtons";
import ZonePicker from "@entries/components/ZonePicker";
import { useZones } from "@/features/zones/hooks/useZones";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { EntryFileType } from "@entries/types";
import { Trash } from "lucide-react";
import SelectedFileItem from "./SelectedFileItem";

export default function EntryForm() {
    const router = useRouter();
    const { selectedHouseholdId } = useGlobal();
    const { t } = useI18n();
    const { zones, loading: loadingZones } = useZones(selectedHouseholdId);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
    type SelectedFile = { file: File; type: EntryFileType; customName: string };
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const fileTypeLabel = useMemo(() => t("entries.fileTypeLabel"), [t]);

    const inferType = (file: File): EntryFileType =>
        file.type && file.type.startsWith("image/") ? "photo" : "document";

    const makeKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

    const handleFilesSelected = (files: File[]) => {
        if (!files.length) return;
        setSelectedFiles(prev => {
            const existing = new Set(prev.map(item => makeKey(item.file)));
            const next = [...prev];
            files.forEach(file => {
                const key = makeKey(file);
                if (!existing.has(key)) {
                    existing.add(key);
                    next.push({ file, type: inferType(file), customName: "" });
                }
            });
            return next;
        });
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleFileTypeChange = (index: number, type: EntryFileType) => {
        setSelectedFiles(prev => {
            const target = prev[index];
            if (!target || !(target.file.type && target.file.type.startsWith("image/"))) {
                return prev;
            }
            return prev.map((item, idx) => (idx === index ? { ...item, type } : item));
        });
    };

    const handleCustomNameChange = (index: number, value: string) => {
        setSelectedFiles(prev => prev.map((item, idx) => (idx === index ? { ...item, customName: value } : item)));
    };

    const resolveFinalFileName = (item: SelectedFile) => {
        const originalName = item.file.name;
        const trimmed = item.customName?.trim() ?? "";
        const extension = originalName.includes(".")
            ? originalName.substring(originalName.lastIndexOf("."))
            : "";
        if (!trimmed) {
            return extension ? `file${extension}` : "file";
        }
        if (trimmed.includes(".")) {
            return trimmed;
        }
        return `${trimmed}${extension}`;
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
                    p_household_id: selectedHouseholdId,
                    p_raw_text: text.trim(),
                    p_zone_ids: selectedZoneIds,
                });

            if (error) throw error;
            const entryId = rpcData as string | null;
            if (!entryId) throw new Error(t("entries.createFailed"));

            const uploadedPaths: string[] = [];

            try {
                if (selectedFiles.length) {
                    for (const item of selectedFiles) {
                        const { file, type } = item;
                        const finalName = resolveFinalFileName(item);
                        const safeName = finalName.replace(/[^0-9a-zA-Z._-]/g, "_");
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

                        const resolvedType: EntryFileType = file.type && file.type.startsWith("image/") ? type : "document";
                        const { error: linkError } = await client
                            .from("entry_files" as any)
                            .insert({
                                entry_id: entryId,
                                storage_path: storagePath,
                                mime_type: file.type || null,
                                type: resolvedType,
                                metadata: {
                                    size: file.size,
                                    customName: finalName,
                                },
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
                        {selectedFiles.map((item, index) => (
                            <SelectedFileItem
                                key={`${item.file.name}-${item.file.lastModified}-${index}`}
                                index={index}
                                file={item.file}
                                type={item.type}
                                customName={item.customName}
                                fileTypeLabel={fileTypeLabel}
                                onCustomNameChange={handleCustomNameChange}
                                onFileTypeChange={handleFileTypeChange}
                                onRemove={handleRemoveFile}
                            />
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
