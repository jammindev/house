import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPhotos, type PhotoDocument } from '@/lib/api/photos';
import PhotoGrid from './PhotoGrid';
import { useHouseholdId } from '@/lib/useHouseholdId';
import PageHeader from '@/components/PageHeader';

type PhotosPageProps = Record<string, never>;

export default function PhotosPage(_props: PhotosPageProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [photos, setPhotos] = React.useState<PhotoDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadPhotos = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPhotos(householdId)
      .then((list) => {
        setPhotos(list);
        setLoading(false);
      })
      .catch(() => {
        setError(t('photos.loadFailed', { defaultValue: 'Failed to load photos.' }));
        setLoading(false);
      });
  }, [householdId, t]);

  React.useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('photos.title', { defaultValue: 'Photos' })} />
      {!loading && !error && photos.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('photos.count', { count: photos.length, defaultValue: '{{count}} photos' })}
        </p>
      ) : null}

      <PhotoGrid
        photos={photos}
        loading={loading}
        error={error}
        onRefresh={loadPhotos}
      />
    </div>
  );
}
