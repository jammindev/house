import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileX, Edit, Trash2, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/design-system/button';
import type { DocumentItem } from '@/lib/api/documents';
import { deleteDocument, formatFileSize } from '@/lib/api/documents';

interface DocumentListItemProps {
  doc: DocumentItem;
  householdId?: string | null;
  onEdit?: (doc: DocumentItem) => void;
  onDeleted?: (id: string) => void;
}

export default function DocumentListItem({
  doc,
  householdId,
  onEdit,
  onDeleted,
}: DocumentListItemProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const fileSize = typeof doc.metadata?.size === 'number' ? formatFileSize(doc.metadata.size) : null;
  const fileName = doc.name || doc.file_path.split('/').pop() || '';

  const handleDelete = () => {
    if (!confirmOpen) {
      setConfirmOpen(true);
      return;
    }
    setDeleting(true);
    deleteDocument(doc.id, householdId)
      .then(() => {
        onDeleted?.(doc.id);
        setConfirmOpen(false);
      })
      .catch(() => {
        setDeleting(false);
        setConfirmOpen(false);
      });
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-start sm:gap-4">
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {doc.file_url ? (
          <FileText className="h-5 w-5 text-blue-500" aria-hidden="true" />
        ) : (
          <FileX className="h-5 w-5 text-gray-400" aria-hidden="true" />
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {doc.file_url ? (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-gray-900 hover:underline"
            >
              {fileName}
            </a>
          ) : (
            <span className="truncate text-sm font-medium text-gray-900">{fileName}</span>
          )}
          {fileSize && (
            <span className="text-xs text-gray-500 flex-shrink-0">{fileSize}</span>
          )}
        </div>
        {doc.notes && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{doc.notes}</p>
        )}
        {/* Linked interaction */}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {doc.interaction ? (
            <a
              href={`/app/interactions/${doc.interaction}/`}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {doc.interaction_subject || t('documents.interactionNoSubject', { defaultValue: 'Interaction' })}
            </a>
          ) : (
            <span className="text-xs text-gray-400">
              {t('documents.noLinkedInteractions', { defaultValue: 'No linked interaction' })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {doc.file_url && (
          <a
            href={doc.file_url}
            download={fileName}
            aria-label={t('common.download', { defaultValue: 'Download' })}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('documents.edit', { defaultValue: 'Edit' })}
            onClick={() => onEdit(doc)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDeleted && !confirmOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:text-red-700"
            aria-label={`${t('common.delete', { defaultValue: 'Delete' })} ${fileName}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {confirmOpen && (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? t('common.deleting', { defaultValue: 'Deleting…' })
                : t('common.confirm', { defaultValue: 'Confirm' })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
