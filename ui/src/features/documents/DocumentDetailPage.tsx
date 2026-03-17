import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, Plus } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatFileSize } from '@/lib/api/documents';
import { useDocument, useDocumentInteractions, useDeleteDocument, documentKeys } from './hooks';
import DocumentEditDialog from './DocumentEditDialog';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: doc, isLoading, error } = useDocument(id ?? '');
  const { data: interactions = [], isLoading: interactionsLoading } = useDocumentInteractions(id ?? '');
  const deleteMutation = useDeleteDocument();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: documentKeys.all });
  }, [qc]);

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/app/documents'),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('documents.detail.not_found')}
      </div>
    );
  }

  const fileName = doc.name || doc.file_path.split('/').pop() || '';
  const fileSize =
    typeof doc.metadata?.size === 'number' ? formatFileSize(doc.metadata.size) : null;

  return (
    <>
      <div className="space-y-4">
        {/* Back */}
        <Link
          to="/app/documents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('documents.title')}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{fileName}</h1>
              {doc.type && doc.type !== 'photo' && (
                <Badge variant="secondary" className="text-xs">
                  {t(`documents.type.${doc.type}`, { defaultValue: doc.type })}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(doc.created_at)}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setEditOpen(true)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-8 px-3 text-sm"
              onClick={() => setDeleteOpen(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>

        {/* File info */}
        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            {fileSize && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium text-foreground">{fileSize}</span>
              </div>
            )}
            {doc.mime_type && (
              <div className="text-muted-foreground">
                <span className="font-mono text-xs">{doc.mime_type}</span>
              </div>
            )}
            {doc.notes && (
              <p className="text-muted-foreground">{doc.notes}</p>
            )}
            {doc.file_url ? (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                {t('documents.detail.download')}
              </a>
            ) : null}
          </CardContent>
        </Card>

        {/* Linked interactions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {t('documents.detail.linked_interactions')}
            </h2>
            <Link
              to={`/app/interactions/new?source_document_id=${id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('documents.detail.add_activity')}
            </Link>
          </div>

          {interactionsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : interactions.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              {t('documents.detail.no_linked_interactions')}
            </p>
          ) : (
            <ul className="space-y-2">
              {interactions.map((item) => (
                <li key={item.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{item.subject || '—'}</span>
                      {item.occurred_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(item.occurred_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.type && (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {t(`interactions.type.${item.type}`, { defaultValue: item.type })}
                        </Badge>
                      )}
                      <Link
                        to={`/app/interactions/${item.id}/edit`}
                        className="ml-1 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                        aria-label={t('common.edit')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DocumentEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        doc={doc}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('documents.deleted')}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
