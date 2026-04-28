import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDocuments, documentKeys } from '@/features/documents/hooks';
import DocumentCard from '@/features/documents/DocumentCard';
import DocumentEditDialog from '@/features/documents/DocumentEditDialog';
import { useDetachProjectDocument } from './hooks';
import ProjectAttachDocumentDialog from './ProjectAttachDocumentDialog';
import type { DocumentItem } from '@/lib/api/documents';

interface Props {
  projectId: string;
}

export default function ProjectDocumentsTab({ projectId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const filters = React.useMemo(() => ({ project: projectId }), [projectId]);
  const { data: documents = [], isLoading, error } = useDocuments(filters);
  const detachMutation = useDetachProjectDocument(projectId);

  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);
  const [attachOpen, setAttachOpen] = React.useState(false);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('projects.attach_document.detached'),
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

  const showSkeleton = useDelayedLoading(isLoading);
  const attachedIds = React.useMemo(
    () => new Set(documents.map((d) => d.id)),
    [documents],
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setAttachOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('projects.attach_document.title')}
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
            {t('projects.empty_documents')}
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onEdit={setEditingDoc}
                onDelete={handleDetach}
                deleteLabel={t('projects.attach_document.detach')}
              />
            ))}
          </ul>
        )}
      </div>

      <DocumentEditDialog
        open={editingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
        doc={editingDoc}
        onSaved={() => qc.invalidateQueries({ queryKey: documentKeys.all })}
      />

      <ProjectAttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        projectId={projectId}
        attachedIds={attachedIds}
      />
    </>
  );
}
