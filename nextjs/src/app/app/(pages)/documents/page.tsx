// nextjs/src/app/app/(pages)/documents/page.tsx
"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { DocumentUploadSection, DocumentsSection, useDocumentHighlight } from "@/features/documents";

export default function DocumentsPage() {
  const { t } = useI18n();
  const { highlightedIds, highlightDocuments } = useDocumentHighlight();

  const handleUploadSuccess = (uploadedIds: string[]) => {
    highlightDocuments(uploadedIds);
  };

  return (
    <ResourcePageShell
      title={t("documents.title")}
      subtitle={t("documents.subtitle")}
      hideBackButton
      bodyClassName="space-y-2"
    >
      <DocumentUploadSection onUploadSuccess={handleUploadSuccess} />
      <DocumentsSection highlightedIds={highlightedIds} />
    </ResourcePageShell>
  );
}
