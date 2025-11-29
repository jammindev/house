"use client";

import { useMemo } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document } from "@interactions/types";
import { DocumentsList } from "@/features/documents/components/DocumentsList";
import type { DocumentWithLinks } from "@/features/documents/types";

interface ProjectDocumentsPanelProps {
  documents: Document[];
}

export default function ProjectDocumentsPanel({ documents }: ProjectDocumentsPanelProps) {
  const { t } = useI18n();

  // Transform documents to DocumentWithLinks format (without interaction links for project view)
  const documentsWithLinks: DocumentWithLinks[] = useMemo(() => 
    documents.map((doc) => ({
      ...doc,
      links: [], // No interaction links shown in project context
    })), 
    [documents]
  );

  // Empty state handled by DocumentsList
  return (
    <DocumentsList
      documents={documentsWithLinks}
      loading={false}
      error={null}
      onRefresh={() => {}} // No refresh needed in project context
      filterActive={false}
      highlightedIds={[]}
      readonly={true} // Make documents read-only in project context
    />
  );
}
