import * as React from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { FilterBar } from '@/design-system/filter-bar';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { DOCUMENT_TYPES, type DocumentItem } from '@/lib/api/documents';
import { useDocuments, useDeleteDocument, documentKeys } from './hooks';
import DocumentCard from './DocumentCard';
import DocumentUploadDialog from './DocumentUploadDialog';
import DocumentEditDialog from './DocumentEditDialog';

export default function DocumentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState('');
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(type ? { type } : {}),
    }),
    [search, type],
  );

  const { data: documents = [], isLoading, error } = useDocuments(filters);
  const deleteDocumentMutation = useDeleteDocument();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: documentKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('documents.deleted'),
    onDelete: (id) => deleteDocumentMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      deleteWithUndo(docId, {
        onRemove: () =>
          qc.setQueryData<DocumentItem[]>(
            documentKeys.list(filters),
            (old) => old?.filter((d) => d.id !== docId),
          ),
        onRestore: () =>
          qc.setQueryData<DocumentItem[]>(
            documentKeys.list(filters),
            (old) => (old ? [...old, doc] : [doc]),
          ),
      });
    },
    [documents, deleteWithUndo, qc, filters],
  );

  function resetFilters() {
    setSearch('');
    setType('');
  }

  const typeOptions = [
    { value: '', label: t('documents.filter.allTypes') },
    ...DOCUMENT_TYPES.map((v) => ({
      value: v,
      label: t(`documents.type.${v}`, { defaultValue: v }),
    })),
  ];

  const isEmpty = !isLoading && !error && documents.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('documents.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: FileText,
          title: t('documents.empty'),
          description: t('documents.empty_description'),
          action: { label: t('documents.upload.title'), onClick: () => setUploadOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('documents.upload.title')}
          </button>
        }
      >
        <div className="space-y-4">
          <FilterBar
            fields={[
              {
                type: 'search',
                id: 'documents-search',
                label: t('documents.search'),
                value: search,
                onChange: setSearch,
                placeholder: t('documents.search_placeholder'),
              },
              {
                type: 'select',
                id: 'documents-type',
                label: t('documents.fieldType'),
                value: type,
                onChange: setType,
                options: typeOptions,
              },
            ]}
            onReset={resetFilters}
            hasActiveFilters={!!(search || type)}
            resetLabel={t('equipment.reset')}
            applyLabel={t('equipment.apply')}
          />

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {t('documents.loadFailed')}
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: documentKeys.all })}
                className="ml-2 underline hover:no-underline"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onEdit={setEditingDoc}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </ListPage>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={handleSaved}
      />

      <DocumentEditDialog
        open={editingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
        doc={editingDoc}
        onSaved={handleSaved}
      />
    </>
  );
}
