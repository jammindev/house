// nextjs/src/app/app/entries/[id]/page.tsx
"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEntry } from "@entries/hooks/useEntry";
import EntryDeleteButton from "@entries/components/EntryDeleteButton";
import PdfFileList from "@/features/entries/components/pdf/PdfFileList";
import ImageGallery from "@/features/entries/components/gallery/ImageGallery";
import { useSignedFilePreviews } from "@/features/entries/hooks/useSignedFilePreviews";
import EntryAttachmentImport from "@/features/entries/components/EntryAttachmentImport";

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { entry, files, loading, error, reload } = useEntry(id);
  const { previews, error: fileError } = useSignedFilePreviews(files);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!entry) return <div className="p-6 text-gray-500">{t("entries.notFound")}</div>;

  const classifyAsPhoto = (file: (typeof files)[number]) =>
    file.type === "photo";
  const classifyAsDocument = (file: (typeof files)[number]) =>
    file.type === "document";

  const pdfFiles = files.filter(classifyAsDocument);
  const imageFiles = files.filter(classifyAsPhoto);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center">
            <Button asChild variant="ghost" size="icon">
              <Link href="/app/entries">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">{t("entries.detail")}</h1>
          </div>
        </div>
        <div className="flex justify-end">
          {entry && <EntryAttachmentImport entryId={entry.id} onUploaded={reload} />}
        </div>
      </header>
      <div className="text-sm text-gray-500">
        {new Date(entry.created_at).toLocaleString()}
      </div>
      <pre className="whitespace-pre-wrap text-gray-900">{entry.raw_text}</pre>
      {fileError && (
        <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
          {fileError}
        </div>
      )}

      {pdfFiles.length > 0 && <PdfFileList files={pdfFiles} previews={previews} onDeleted={reload} />}

      {imageFiles.length > 0 && <ImageGallery files={imageFiles} previews={previews} onDeleted={reload} />}

      <EntryDeleteButton entryId={entry.id} onDeleted={() => router.push("/app/entries")} />
    </div>
  );
}
