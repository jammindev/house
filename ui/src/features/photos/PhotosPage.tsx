import * as React from 'react';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { DocumentItem } from '@/lib/api/documents';
import DocumentUploadDialog from '@/features/documents/DocumentUploadDialog';
import { usePhotos, useDeletePhoto, photoKeys } from './hooks';
import PhotoGrid from './PhotoGrid';
import PhotoDetailPanel from './PhotoDetailPanel';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

export default function PhotosPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [selectedPhoto, setSelectedPhoto] = React.useState<DocumentItem | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const filters = React.useMemo(
    () => (search ? { search } : undefined),
    [search],
  );

  const { data: photos = [], isLoading, error } = usePhotos(filters);
  const deletePhotoMutation = useDeletePhoto();

  const handleDelete = React.useCallback(
    (id: string) => {
      deletePhotoMutation.mutate(id, {
        onSuccess: () => setDeletingId(null),
      });
    },
    [deletePhotoMutation],
  );

  const isEmpty = !isLoading && !error && photos.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('photos.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: Camera,
          title: t('photos.empty'),
          description: t('photos.empty_description'),
          action: { label: t('photos.upload_title'), onClick: () => setUploadOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('photos.upload_title')}
          </button>
        }
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {t('photos.loadFailed')}
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: photoKeys.all })}
              className="ml-2 underline hover:no-underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {/* Filter bar */}
        {!error ? (
          <div className="mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('photos.search_placeholder')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-xs"
              aria-label={t('photos.search')}
            />
          </div>
        ) : null}

        {showSkeleton ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <PhotoGrid photos={photos} onPhotoClick={setSelectedPhoto} />
        ) : null}
      </ListPage>

      <PhotoDetailPanel
        photo={selectedPhoto}
        open={selectedPhoto !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPhoto(null);
        }}
        onDelete={(id) => {
          setSelectedPhoto(null);
          setDeletingId(id);
        }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title={t('common.confirmDelete')}
        onConfirm={() => {
          if (deletingId) handleDelete(deletingId);
        }}
        loading={deletePhotoMutation.isPending}
      />

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: photoKeys.all })}
        forcedType="photo"
      />
    </>
  );
}
