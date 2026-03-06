import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDocuments, type DocumentItem } from '@/lib/api/documents';
import DocumentListItem from './DocumentListItem';
import DocumentsFilters from './DocumentsFilters';
import EditDocumentModal from './EditDocumentModal';

interface DocumentsPageProps {
  householdId?: string | null;
}

export default function DocumentsPage({ householdId }: DocumentsPageProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unlinkedOnly, setUnlinkedOnly] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);

  const loadDocuments = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDocuments(householdId)
      .then((list) => {
        setDocuments(list);
        setLoading(false);
      })
      .catch(() => {
        setError(t('documents.loadFailed', { defaultValue: 'Failed to load documents.' }));
        setLoading(false);
      });
  }, [householdId, t]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = React.useMemo(() => {
    if (!unlinkedOnly) return documents;
    return documents.filter((d) => !d.interaction);
  }, [documents, unlinkedOnly]);

  const unlinkedCount = React.useMemo(
    () => documents.filter((d) => !d.interaction).length,
    [documents],
  );

  const handleDeleted = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleEditSuccess = (updated: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('documents.title', { defaultValue: 'Documents' })}
          </h1>
        </div>
      </div>

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
              ? t('documents.emptyUnlinked', { defaultValue: 'No unlinked documents.' })
              : t('documents.empty', { defaultValue: 'No documents yet.' })}
          </p>
        </div>
      )}

      {!loading && !error && filteredDocuments.length > 0 && (
        <ul className="space-y-2">
          {filteredDocuments.map((doc) => (
            <DocumentListItem
              key={doc.id}
              doc={doc}
              householdId={householdId}
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
        householdId={householdId}
      />
    </div>
  );
}
