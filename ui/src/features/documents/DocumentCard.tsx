import { Link } from 'react-router-dom';
import { FileText, FileX, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatFileSize, type DocumentItem } from '@/lib/api/documents';

interface DocumentCardProps {
  doc: DocumentItem;
  onEdit: (doc: DocumentItem) => void;
  onDelete: (id: string) => void;
}

export default function DocumentCard({ doc, onEdit, onDelete }: DocumentCardProps) {
  const { t } = useTranslation();

  const fileName = doc.name || doc.file_path.split('/').pop() || '';
  const fileSize =
    typeof doc.metadata?.size === 'number' ? formatFileSize(doc.metadata.size) : null;
  const createdDate = new Date(doc.created_at).toLocaleDateString();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(doc) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(doc.id), variant: 'danger' },
  ];

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4">
      {/* File icon */}
      <div className="mt-0.5 flex-shrink-0">
        {doc.file_url ? (
          <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
        ) : (
          <FileX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {/* Name + metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/documents/${doc.id}`}
            className="truncate text-sm font-medium text-foreground hover:underline"
          >
            {fileName}
          </Link>

          {doc.type && doc.type !== 'photo' && (
            <Badge variant="secondary" className="text-xs">
              {t(`documents.type.${doc.type}`, { defaultValue: doc.type })}
            </Badge>
          )}

          {fileSize && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">{fileSize}</span>
          )}
        </div>

        {doc.notes && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{doc.notes}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{createdDate}</span>

          {doc.linked_interactions.length > 0 && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {doc.linked_interactions[0].subject}
            </span>
          )}

          {doc.qualification.qualification_state === 'without_activity' && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {t('documents.qualification.withoutActivity')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <CardActions actions={actions} />
    </li>
  );
}
