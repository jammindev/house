"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEntry } from "@entries/hooks/useEntry";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import PdfFileList from "@/features/entries/components/pdf/PdfFileList";
import ImageGallery from "@/features/entries/components/gallery/ImageGallery";

const SIGNED_URL_TTL = 300;
const REFRESH_BEFORE_EXPIRY = 20;

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { entry, files, loading, error } = useEntry(id);
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
            const fileName = file.storage_path.split("/").pop() ?? "file";

            const { data: viewData, error: viewError } = await client.storage
              .from("files")
              .createSignedUrl(file.storage_path, SIGNED_URL_TTL);

            if (viewError) throw viewError;

            const { data: downloadData, error: downloadError } = await client.storage
              .from("files")
              .createSignedUrl(file.storage_path, SIGNED_URL_TTL, { download: fileName });

            if (downloadError) throw downloadError;

            return [
              file.id,
              {
                view: viewData.signedUrl,
                download: downloadData.signedUrl,
              },
            ] as const;
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

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!entry) return <div className="p-6 text-gray-500">{t("entries.notFound")}</div>;

  const pdfFiles = files.filter((f) => f.mime_type?.includes("pdf"));
  const imageFiles = files.filter((f) => f.mime_type?.startsWith("image/"));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold">{t("entries.detail")}</h1>
        <div className="text-sm text-gray-500">
          {new Date(entry.created_at).toLocaleString()}
        </div>
      </header>

      <pre className="whitespace-pre-wrap text-gray-900">{entry.raw_text}</pre>

      {fileError && (
        <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
          {fileError}
        </div>
      )}

      {pdfFiles.length > 0 && <PdfFileList files={pdfFiles} previews={previews} />}

      {imageFiles.length > 0 && <ImageGallery files={imageFiles} previews={previews} />}
    </div>
  );
}