import { Camera, Download, ExternalLink, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/design-system/dialog';
import { Button } from '@/design-system/button';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import type { DocumentItem } from '@/lib/api/documents';

interface PhotoDetailPanelProps {
  photo: DocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
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

export default function PhotoDetailPanel({ photo, open, onOpenChange, onDelete }: PhotoDetailPanelProps) {
  const { t } = useTranslation();

  if (!photo) return null;

  const fileSize = formatFileSize(photo.metadata?.size as number | undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Image */}
          <div className="relative flex min-h-[40vh] w-full items-center justify-center bg-gradient-to-b from-slate-900 to-black lg:min-h-[60vh] lg:flex-1">
            {photo.medium_url || photo.file_url ? (
              <img
                src={photo.medium_url || photo.file_url || ''}
                alt={photo.name}
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-500">
                <Camera className="h-12 w-12" aria-hidden />
              </div>
            )}
          </div>

          {/* Metadata panel */}
          <div className="flex w-full flex-col gap-4 p-5 lg:w-72 lg:border-l lg:border-slate-200">
            <DialogHeader className="space-y-0">
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-base font-semibold text-slate-900 leading-snug">
                  {photo.name || t('photos.untitled')}
                </DialogTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-600"
                  onClick={() => onOpenChange(false)}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('photos.addedOn', { date: formatDate(photo.created_at) })}
                {fileSize ? ` · ${fileSize}` : ''}
              </p>
            </DialogHeader>

            {photo.notes?.trim() ? (
              <p className="text-sm text-slate-700 leading-relaxed">{photo.notes}</p>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              {photo.file_url ? (
                <>
                  <a
                    href={photo.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                    {t('photos.view')}
                  </a>
                  <a
                    href={photo.file_url}
                    download
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    {t('photos.download')}
                  </a>
                </>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  onDelete(photo.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
