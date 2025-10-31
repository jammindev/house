// nextjs/src/app/app/documents/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { DocumentsFilters } from "@/features/documents/components/DocumentsFilters";
import { DocumentsList } from "@/features/documents/components/DocumentsList";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function DocumentsPage() {
  const { t } = useI18n();
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const setPageLayoutConfig = usePageLayoutConfig();

  const { documents, loading, error, refresh, unlinkedCount } = useDocuments();

  const filteredDocuments = useMemo(() => {
    if (!unlinkedOnly) return documents;
    return documents.filter((doc) => doc.links.length === 0);
  }, [documents, unlinkedOnly]);

  const errorMessage = error ? `${t("documents.loadFailed")} (${error})` : null;

  useEffect(() => {
    setPageLayoutConfig({
      title: t("documents.title"),
      subtitle: t("documents.subtitle"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      hideBackButton: true,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
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
  );
}
