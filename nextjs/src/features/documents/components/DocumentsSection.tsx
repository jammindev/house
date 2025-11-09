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

    // Exclude documents of type 'photo' entirely per request
    const nonPhotoDocuments = useMemo(() => documents.filter((doc) => doc.type !== "photo"), [documents]);

    const filteredDocuments = useMemo(() => {
        if (!unlinkedOnly) return nonPhotoDocuments;
        return nonPhotoDocuments.filter((doc) => doc.links.length === 0);
    }, [nonPhotoDocuments, unlinkedOnly]);

    const unlinkedCountFiltered = useMemo(() => nonPhotoDocuments.filter((d) => d.links.length === 0).length, [nonPhotoDocuments]);

    const errorMessage = error ? `${t("documents.loadFailed")} (${error})` : null;

    return (
        <div className="space-y-4">
            <DocumentsFilters
                unlinkedOnly={unlinkedOnly}
                onToggle={setUnlinkedOnly}
                totalCount={nonPhotoDocuments.length}
                unlinkedCount={unlinkedCountFiltered}
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