import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import type { PhotoDocument } from '@/lib/api/photos';

interface PhotoDetailsPanelProps {
  photo: PhotoDocument;
}

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PhotoDetailsPanel({ photo }: PhotoDetailsPanelProps) {
  const { t } = useTranslation();
  const fileSize = formatFileSize(photo.metadata?.size as number | undefined);

  return (
    <article className="flex h-full flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {photo.name || t('documents.untitledDocument', { defaultValue: 'Untitled' })}
        </h3>
        <p className="text-xs text-gray-500">
          {t('photos.addedOn', { date: formatDate(photo.created_at), defaultValue: 'Added {{date}}' })}
          {fileSize ? ` · ${fileSize}` : ''}
        </p>
      </div>

      {photo.notes?.trim() ? (
        <p className="text-sm text-gray-700 leading-relaxed">{photo.notes}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <a
          href={photo.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
        >
          <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
          {t('photos.view', { defaultValue: 'View' })}
        </a>
        <a
          href={photo.file_url}
          download
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t('photos.download', { defaultValue: 'Download' })}
        </a>
      </div>
    </article>
  );
}
