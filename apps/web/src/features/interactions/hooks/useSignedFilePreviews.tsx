import { useEffect, useRef, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document } from "@interactions/types";
import { getInteractionFileName } from "@interactions/utils/getInteractionFileName";

const SIGNED_URL_TTL = 300;
const REFRESH_BEFORE_EXPIRY = 20;
const IMAGE_VIEW_TRANSFORM = { width: 1600, height: 1600, resize: "contain" as const, quality: 80 };
const IMAGE_THUMBNAIL_TRANSFORM = { width: 480, height: 480, resize: "cover" as const, quality: 60 };

export type FilePreview = {
    view?: string;
    download?: string;
    thumbnail?: string;
};

export function useSignedFilePreviews(files: Document[]) {
    const { t } = useI18n();
    const [previews, setPreviews] = useState<Record<string, FilePreview>>({});
    const [fileError, setFileError] = useState("");
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!files.length) {
            setPreviews({});
            return;
        }

        let cancelled = false;

        const loadPreviews = async () => {
            try {
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();

                const interactions = await Promise.all(
                    files.map(async (file) => {
                        const fileName = getInteractionFileName(file) || "file";
                        const isPhoto = file.type === "photo";

                        const { data: viewData, error: viewError } = await client.storage
                            .from("files")
                            .createSignedUrl(
                                file.file_path,
                                SIGNED_URL_TTL,
                                isPhoto ? { transform: IMAGE_VIEW_TRANSFORM } : undefined
                            );

                        if (viewError) throw viewError;

                        let thumbnailUrl: string | undefined;
                        if (isPhoto) {
                            const { data: thumbnailData, error: thumbnailError } = await client.storage
                                .from("files")
                                .createSignedUrl(file.file_path, SIGNED_URL_TTL, {
                                    transform: IMAGE_THUMBNAIL_TRANSFORM,
                                });
                            if (!thumbnailError) {
                                thumbnailUrl = thumbnailData?.signedUrl;
                            } else {
                                console.warn("Failed to create thumbnail signed URL", thumbnailError);
                            }
                        }

                        const { data: downloadData, error: downloadError } = await client.storage
                            .from("files")
                            .createSignedUrl(file.file_path, SIGNED_URL_TTL, { download: fileName });

                        if (downloadError) throw downloadError;

                        const viewUrl = viewData?.signedUrl;
                        const downloadUrl = downloadData?.signedUrl;

                        return [
                            file.id,
                            {
                                view: viewUrl,
                                download: downloadUrl,
                                thumbnail: thumbnailUrl ?? viewUrl,
                            },
                        ] as const;
                    })
                );

                if (!cancelled) {
                    setPreviews(Object.fromEntries(interactions));
                    setFileError("");

                    if (refreshTimerRef.current) {
                        clearTimeout(refreshTimerRef.current);
                    }
                    const refreshDelay = (SIGNED_URL_TTL - REFRESH_BEFORE_EXPIRY) * 1000;
                    refreshTimerRef.current = setTimeout(loadPreviews, refreshDelay);
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) setFileError(t("storage.downloadFailed"));
            }
        };

        loadPreviews();
        return () => {
            cancelled = true;
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [files, t]);

    return { previews, error: fileError };
}
