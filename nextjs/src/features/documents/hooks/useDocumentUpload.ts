// nextjs/src/features/documents/hooks/useDocumentUpload.ts
"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { DocumentType } from "@interactions/types";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";
import { createLocalId, sanitizeFilename, inferDocumentType } from "@documents/utils/uploadHelpers";
import type { StagedFile } from "@documents/types";

export type { StagedFile };

export function useDocumentUpload() {
    const { t } = useI18n();
    const { selectedHouseholdId, user } = useGlobal();

    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const stageFiles = useCallback((files: FileList | File[]) => {
        const fileArray = Array.from(files ?? []).filter((file) => file.size > 0);
        if (!fileArray.length) return;

        setError(null);
        setSuccess(null);
        setStagedFiles((prev) => [
            ...prev,
            ...fileArray.map((file) => ({
                id: createLocalId(),
                file,
                name: file.name,
                type: inferDocumentType(file),
            })),
        ]);
    }, []);

    const removeStagedFile = useCallback((id: string) => {
        setStagedFiles((prev) => prev.filter((file) => file.id !== id));
    }, []);

    const updateStagedFile = useCallback((id: string, changes: Partial<Pick<StagedFile, "name" | "type">>) => {
        setStagedFiles((prev) =>
            prev.map((file) =>
                file.id === id ? { ...file, ...changes } : file
            )
        );
    }, []);

    const clearStaged = useCallback(() => {
        setStagedFiles([]);
        setError(null);
        setSuccess(null);
    }, []);

    const uploadFiles = useCallback(async (): Promise<string[]> => {
        if (!selectedHouseholdId) {
            throw new Error(t("storage.noHousehold"));
        }

        if (!stagedFiles.length) {
            throw new Error(t("storage.noFilesStaged"));
        }

        if (stagedFiles.some((file) => !file.type)) {
            throw new Error(t("storage.typeRequired"));
        }

        setUploading(true);
        setError(null);
        setSuccess(null);

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            let userId = user?.id ?? null;
            if (!userId) {
                const { data: authData, error: authError } = await client.auth.getUser();
                if (authError) throw authError;
                userId = authData?.user?.id ?? null;
            }
            if (!userId) {
                throw new Error(t("storage.noUser"));
            }

            const createdIds: string[] = [];

            for (const staged of stagedFiles) {
                const compressionResult = await compressFileForUpload(staged.file);
                const fileForUpload = compressionResult.file;
                const safeName = sanitizeFilename(fileForUpload.name || staged.file.name || staged.name);
                const uniquePrefix =
                    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                        ? crypto.randomUUID()
                        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const storagePath = `${userId}/documents/${uniquePrefix}_${safeName}`;

                const { error: uploadError } = await client.storage.from("files").upload(storagePath, fileForUpload, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: fileForUpload.type || undefined,
                });
                if (uploadError) throw uploadError;

                const { data: insertedDoc, error: insertError } = await client
                    .from("documents")
                    .insert({
                        household_id: selectedHouseholdId,
                        file_path: storagePath,
                        mime_type: fileForUpload.type || null,
                        type: staged.type,
                        name: staged.name?.trim() || staged.file.name,
                        notes: "",
                        created_by: userId,
                        metadata: {
                            ...buildDocumentMetadata(staged.file, compressionResult),
                            quickUpload: true,
                            uploadSource: "documents_page",
                        },
                    })
                    .select("id")
                    .single();

                if (insertError || !insertedDoc) {
                    throw insertError ?? new Error(t("storage.insertDocumentFailed"));
                }

                createdIds.push((insertedDoc as { id: string }).id);
            }

            const successKey =
                stagedFiles.length > 1 ? "storage.uploadSuccessPlural" : "storage.uploadSuccessSingle";
            setSuccess(t(successKey, { count: stagedFiles.length }));
            setStagedFiles([]);

            return createdIds;
        } catch (uploadErr: unknown) {
            console.error(uploadErr);
            const errorMessage = uploadErr instanceof Error ? uploadErr.message : t("storage.uploadFailed");
            setError(errorMessage);
            throw uploadErr;
        } finally {
            setUploading(false);
        }
    }, [selectedHouseholdId, stagedFiles, t, user?.id]);

    return {
        stagedFiles,
        uploading,
        error,
        success,
        stageFiles,
        removeStagedFile,
        updateStagedFile,
        clearStaged,
        uploadFiles,
        canUpload: stagedFiles.length > 0 && !uploading && stagedFiles.every(file => file.type),
    };
}