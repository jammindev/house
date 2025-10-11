"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEntry } from "@entries/hooks/useEntry";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import PdfFileList from "@/features/entries/components/PdfFileList";
import ImageGallery from "@/features/entries/components/gallery/ImageGallery";

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { entry, files, loading, error } = useEntry(id);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState("");

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
            const { data, error: signedError } = await client.storage
              .from("files")
              .createSignedUrl(file.storage_path, 120);
            if (signedError) throw signedError;
            if (!data?.signedUrl) throw new Error("Missing signed URL");
            return [file.id, data.signedUrl] as const;
          })
        );
        if (!cancelled) setPreviews(Object.fromEntries(entries));
      } catch (e) {
        console.error(e);
        if (!cancelled) setFileError(t("storage.downloadFailed"));
      }
    };

    loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [files, t]);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!entry) return <div className="p-6 text-gray-500">{t("entries.notFound")}</div>;

  // Séparer fichiers
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

      {pdfFiles.length > 0 && (
        <PdfFileList files={pdfFiles} previews={previews} t={t} />
      )}

      {imageFiles.length > 0 && (
        <ImageGallery files={imageFiles} previews={previews} />
      )}
    </div>
  );
}