import { useEffect, useState } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document } from "@interactions/types";
import { getEntryFileName } from "@interactions/utils/getEntryFileName";

const SIGNED_URL_TTL = 300;
const REFRESH_BEFORE_EXPIRY = 20;

export function useSignedFilePreviews(files: Document[]) {
    const { t } = useI18n();
    const [previews, setPreviews] = useState<Record<string, { view: string; download: string }>>({});
    const [fileError, setFileError] = useState("");
    const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

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

                const entries = await Promise.all(
                    files.map(async (file) => {
                        const fileName = getEntryFileName(file) || "file";

                        const { data: viewData, error: viewError } = await client.storage
                            .from("files")
                            .createSignedUrl(file.file_path, SIGNED_URL_TTL);

                        if (viewError) throw viewError;

                        const { data: downloadData, error: downloadError } = await client.storage
                            .from("files")
                            .createSignedUrl(file.file_path, SIGNED_URL_TTL, { download: fileName });

                        if (downloadError) throw downloadError;

                        return [file.id, { view: viewData.signedUrl, download: downloadData.signedUrl }] as const;
                    })
                );

                if (!cancelled) {
                    setPreviews(Object.fromEntries(entries));
                    setFileError("");

                    if (refreshTimer) clearTimeout(refreshTimer);
                    const refreshDelay = (SIGNED_URL_TTL - REFRESH_BEFORE_EXPIRY) * 1000;
                    const timer = setTimeout(loadPreviews, refreshDelay);
                    setRefreshTimer(timer);
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) setFileError(t("storage.downloadFailed"));
            }
        };

        loadPreviews();
        return () => {
            cancelled = true;
            if (refreshTimer) clearTimeout(refreshTimer);
        };
    }, [files, t]);

    return { previews, error: fileError };
}
