// nextjs/src/app/app/documents/page.tsx
"use client";

import { useMemo, useState } from "react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { DocumentsFilters } from "@/features/documents/components/DocumentsFilters";
import { DocumentsList } from "@/features/documents/components/DocumentsList";
import { useDocuments } from "@/features/documents/hooks/useDocuments";

export default function DocumentsPage() {
  const { t } = useI18n();
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);

  const { documents, loading, error, refresh, unlinkedCount } = useDocuments();

  const filteredDocuments = useMemo(() => {
    if (!unlinkedOnly) return documents;
    return documents.filter((doc) => doc.links.length === 0);
  }, [documents, unlinkedOnly]);

  const errorMessage = error ? `${t("documents.loadFailed")} (${error})` : null;

  return (
    <AppPageLayout title={t("documents.title")} subtitle={t("documents.subtitle")}>
      <div className="space-y-4">
        <>
          <DocumentsFilters
            unlinkedOnly={unlinkedOnly}
            onToggle={setUnlinkedOnly}
            totalCount={documents.length}
            unlinkedCount={unlinkedCount}
          />
          <DocumentsList
            documents={filteredDocuments}
            loading={loading}
            error={errorMessage}
            onRefresh={refresh}
            filterActive={unlinkedOnly}
          />
        </>
      </div>
    </AppPageLayout>
  );
}
