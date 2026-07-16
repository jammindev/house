import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDocuments, documentKeys, useAttachEntityDocument, useDetachEntityDocument } from './hooks';
import DocumentCard from './DocumentCard';
import DocumentEditDialog from './DocumentEditDialog';
import DocumentUploadDialog from './DocumentUploadDialog';
import EntityAttachDocumentDialog from './EntityAttachDocumentDialog';
import type { DocumentItem, DocumentDetail } from '@/lib/api/documents';

interface Props {
  /** A household entity type that supports document linking (e.g. 'project', 'equipment'). */
  entityType: string;
  /** The entity's id. */
  objectId: string;
}

/**
 * Generic documents tab: upload a new document (auto-attached) or pick from
 * existing ones, for ANY linkable entity. Drop it into a detail page's TabShell
 * with `entityType` / `objectId` — mirrors the EntityAssistant ergonomics.
 */
export default function EntityDocumentsTab({ entityType, objectId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const filters = React.useMemo(() => ({ [entityType]: objectId }), [entityType, objectId]);
  const { data: documents = [], isLoading, error } = useDocuments(filters);
  const attachMutation = useAttachEntityDocument(entityType, objectId);
  const detachMutation = useDetachEntityDocument(entityType, objectId);

  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('documents.link.detached'),
    onDelete: (id) => detachMutation.mutateAsync(id),
  });

  const handleDetach = React.useCallback(
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

  const handleUploaded = React.useCallback(
    async (created?: DocumentDetail) => {
      if (created) {
        await attachMutation.mutateAsync(created.id);
      }
      void qc.invalidateQueries({ queryKey: documentKeys.all });
    },
    [attachMutation, qc],
  );

  const showSkeleton = useDelayedLoading(isLoading);
  const attachedIds = React.useMemo(
    () => new Set(documents.map((d) => d.id)),
    [documents],
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAttachOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('documents.link.attach_existing')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {t('documents.link.upload')}
          </Button>
        </div>

        {showSkeleton ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{t('common.error_loading')}</p>
        ) : documents.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t('documents.link.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onEdit={setEditingDoc}
                onDelete={handleDetach}
                deleteLabel={t('documents.link.detach')}
              />
            ))}
          </ul>
        )}
      </div>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={handleUploaded}
      />

      <DocumentEditDialog
        open={editingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
        doc={editingDoc}
        onSaved={() => qc.invalidateQueries({ queryKey: documentKeys.all })}
      />

      <EntityAttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        entityType={entityType}
        objectId={objectId}
        attachedIds={attachedIds}
      />
    </>
  );
}
