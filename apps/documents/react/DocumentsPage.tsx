import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDocuments, type DocumentItem } from '@/lib/api/documents';
import PageHeader from '@/components/PageHeader';
import DocumentListItem from './DocumentListItem';
import DocumentsFilters from './DocumentsFilters';
import EditDocumentModal from './EditDocumentModal';

import { useHouseholdId } from '@/lib/useHouseholdId';

type DocumentsPageProps = {
  title?: string;
  createUrl?: string;
  initialDocuments?: DocumentItem[];
  initialLoaded?: boolean;
  initialCounts?: {
    total: number;
    withoutActivity: number;
  };
  filterDefaults?: {
    withoutActivityOnly: boolean;
  };
};

export default function DocumentsPage(props: DocumentsPageProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [documents, setDocuments] = React.useState<DocumentItem[]>(props.initialDocuments ?? []);
  const [loading, setLoading] = React.useState(!(props.initialLoaded ?? false));
  const [error, setError] = React.useState<string | null>(null);
  const [unlinkedOnly, setUnlinkedOnly] = React.useState(props.filterDefaults?.withoutActivityOnly ?? false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);
  const hasSkippedInitialRefresh = React.useRef(false);

  const loadDocuments = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDocuments(householdId, { withoutActivityOnly: unlinkedOnly })
      .then((list) => {
        setDocuments(list);
        setLoading(false);
      })
      .catch(() => {
        setError(t('documents.loadFailed', { defaultValue: 'Failed to load documents.' }));
        setLoading(false);
      });
  }, [householdId, t, unlinkedOnly]);

  React.useEffect(() => {
    if (props.initialLoaded) {
      return;
    }
    loadDocuments();
  }, [loadDocuments, props.initialLoaded]);

  React.useEffect(() => {
    if (!props.initialLoaded) {
      return;
    }
    if (!hasSkippedInitialRefresh.current) {
      hasSkippedInitialRefresh.current = true;
      return;
    }
    loadDocuments();
  }, [loadDocuments, props.initialLoaded]);

  const filteredDocuments = React.useMemo(() => {
    if (!unlinkedOnly) return documents;
    return documents.filter((d) => d.qualification.qualification_state === 'without_activity');
  }, [documents, unlinkedOnly]);

  const unlinkedCount = React.useMemo(
    () => documents.filter((d) => d.qualification.qualification_state === 'without_activity').length,
    [documents],
  );

  const handleDeleted = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleEditSuccess = (updated: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('documents.title', { defaultValue: 'Documents' })}
        description={t('documents.description', { defaultValue: 'Review recent files and identify which documents still need an activity context.' })}
      >
        {props.createUrl ? (
          <a
            href={props.createUrl}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('documents.add')}
          </a>
        ) : null}
      </PageHeader>

      <DocumentsFilters
        unlinkedOnly={unlinkedOnly}
        onToggle={setUnlinkedOnly}
        totalCount={documents.length}
        unlinkedCount={unlinkedCount}
      />

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={loadDocuments}
            className="ml-2 underline hover:no-underline"
          >
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {!loading && !error && filteredDocuments.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">
            {unlinkedOnly
              ? t('documents.emptyUnlinked')
              : t('documents.empty')}
          </p>
        </div>
      )}

      {!loading && !error && filteredDocuments.length > 0 && (
        <ul className="space-y-2">
          {filteredDocuments.map((doc) => (
            <DocumentListItem
              key={doc.id}
              doc={doc}
              onEdit={setEditingDoc}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      )}

      <EditDocumentModal
        document={editingDoc}
        isOpen={editingDoc !== null}
        onClose={() => setEditingDoc(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
