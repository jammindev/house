// nextjs/src/app/app/interactions/[id]/page.tsx
"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EntryAttachmentImport from "@interactions/components/EntryAttachmentImport";
import EntryDeleteButton from "@interactions/components/EntryDeleteButton";
import EntryRawTextEditor from "@interactions/components/EntryRawTextEditor";
import EntryZonesList from "@interactions/components/EntryZonesList";
import ImageGallery from "@interactions/components/gallery/ImageGallery";
import PdfFileList from "@interactions/components/pdf/PdfFileList";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import { useInteraction } from "@interactions/hooks/useInteraction";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { interaction, documents, loading, error, reload } = useInteraction(id);
  const { previews, error: fileError } = useSignedFilePreviews(documents);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!interaction) return <div className="p-6 text-gray-500">{t("entries.notFound")}</div>;

  const photoDocuments = documents.filter((doc) => doc.type === "photo");
  const documentTypes = new Set(["document", "quote", "invoice", "contract", "other"]);
  const pdfDocuments = documents.filter((doc) => documentTypes.has(doc.type));

  return (
    <div className="max-w-3xl mx-auto md:p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link href="/app/interactions">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{interaction.subject}</h1>
              <p className="text-xs uppercase tracking-wide text-indigo-600">
                {t(`entries.types.${interaction.type}`)}
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(interaction.occurred_at || interaction.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex justify-end">
          <EntryAttachmentImport interactionId={interaction.id} onUploaded={reload} />
        </div>
      </header>

      <EntryZonesList interactionId={interaction.id} />
      <EntryRawTextEditor interactionId={interaction.id} initialContent={interaction.content} onSaved={reload} />
      {fileError && (
        <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
          {fileError}
        </div>
      )}

      {pdfDocuments.length > 0 && <PdfFileList files={pdfDocuments} previews={previews} onDeleted={reload} />}

      {photoDocuments.length > 0 && <ImageGallery files={photoDocuments} previews={previews} onDeleted={reload} />}

      <EntryDeleteButton interactionId={interaction.id} onDeleted={() => router.push("/app/interactions")} />
    </div>
  );
}
