// nextjs/src/features/documents/components/DocumentsSection.tsx
"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { DocumentsFilters } from "./DocumentsFilters";
import { DocumentsList } from "./DocumentsList";
import { useDocuments } from "../hooks/useDocuments";

type DocumentsSectionProps = {
    highlightedIds?: string[];
};

export function DocumentsSection({ highlightedIds = [] }: DocumentsSectionProps) {
    const { t } = useI18n();
    const [unlinkedOnly, setUnlinkedOnly] = useState(true);
    const { documents, loading, error, refresh, unlinkedCount } = useDocuments();

    const filteredDocuments = useMemo(() => {
        if (!unlinkedOnly) return documents;
        return documents.filter((doc) => doc.links.length === 0);
    }, [documents, unlinkedOnly]);

    const errorMessage = error ? `${t("documents.loadFailed")} (${error})` : null;

    return (
        <div className="space-y-4">
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
                highlightedIds={highlightedIds}
            />
        </div>
    );
}