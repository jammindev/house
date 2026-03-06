import * as React from 'react';
import { Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Alert, AlertDescription } from '@/design-system/alert';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import type { PhotoDocument } from '@/lib/api/photos';
import PhotoDetailsPanel from './PhotoDetailsPanel';

interface PhotoGridProps {
  photos: PhotoDocument[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function photoTitle(name: string | null | undefined, fallback: string) {
  return name && name.trim().length > 0 ? name : fallback;
}

export default function PhotoGrid({ photos, loading, error, onRefresh }: PhotoGridProps) {
  const { t } = useTranslation();
  const [openPhotoId, setOpenPhotoId] = React.useState<string | null>(null);
  const isEmpty = !loading && photos.length === 0 && !error;

  const handleOpenChange = (photoId: string, open: boolean) => {
    setOpenPhotoId((current) => {
      if (open) return photoId;
      return current === photoId ? null : current;
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
            {t('photos.refresh', { defaultValue: 'Refresh' })}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-600">
        <ImageIcon className="h-8 w-8 text-gray-400" aria-hidden />
        <p>{t('photos.empty', { defaultValue: 'No photos yet.' })}</p>
        <button
          type="button"
          onClick={onRefresh}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
          {t('photos.refresh', { defaultValue: 'Refresh' })}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
      {photos.map((photo) => {
        const isOpen = openPhotoId === photo.id;
        const title = photoTitle(photo.name, t('documents.untitledDocument', { defaultValue: 'Untitled' }));
        return (
          <SheetDialog
            key={photo.id}
            open={isOpen}
            onOpenChange={(open) => handleOpenChange(photo.id, open)}
            title={title}
            description={photo.notes?.trim() || undefined}
            closeLabel={t('common.close', { defaultValue: 'Close' })}
            contentClassName="gap-6 p-0 sm:p-6"
            containerClassName="h-full"
            trigger={
              <button
                type="button"
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-lg border border-transparent bg-gray-50 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
                  isOpen
                    ? 'ring-2 ring-primary-500 border-primary-200'
                    : 'hover:border-primary-200 hover:ring-1 hover:ring-primary-200/70',
                )}
                aria-pressed={isOpen}
              >
                {photo.file_url ? (
                  <img
                    src={photo.file_url}
                    alt={photo.name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                    <ImageIcon className="h-6 w-6" aria-hidden />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {title}
                </div>
              </button>
            }
          >
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,3.5fr)_minmax(280px,1fr)] lg:items-start">
              <div className="relative flex min-h-[75vh] w-full items-center justify-center overflow-hidden border border-gray-900/10 bg-gradient-to-b from-gray-900 to-black shadow-2xl lg:min-h-[65vh]">
                {photo.file_url ? (
                  <img
                    src={photo.file_url}
                    alt={photo.name || t('photos.previewUnavailable', { defaultValue: 'Preview unavailable' })}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-500">
                    <ImageIcon className="h-10 w-10" aria-hidden />
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-lg shadow-gray-200/60 backdrop-blur lg:self-stretch">
                <PhotoDetailsPanel photo={photo} />
              </div>
            </div>
          </SheetDialog>
        );
      })}
    </div>
  );
}
