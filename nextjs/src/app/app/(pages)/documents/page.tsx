// nextjs/src/app/app/(pages)/documents/page.tsx
"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import type { PageAction } from "@/components/layout/AppPageLayout";
import { DocumentUploadButton, DocumentsSection, useDocumentHighlight } from "@/features/documents";

export default function DocumentsPage() {
  const { t } = useI18n();
  const { highlightedIds, highlightDocuments } = useDocumentHighlight();

  const handleUploadSuccess = (uploadedIds: string[]) => {
    highlightDocuments(uploadedIds);
  };

  const actions = useMemo<PageAction[]>(() => [
    {
      element: <DocumentUploadButton onUploadSuccess={handleUploadSuccess} />
    }
  ], []);

  return (
    <ResourcePageShell
      title={t("documents.title")}
      subtitle={t("documents.subtitle")}
      hideBackButton
      bodyClassName="space-y-2"
      actions={actions}
    >
      <DocumentsSection highlightedIds={highlightedIds} />
    </ResourcePageShell>
  );
}
