import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPhotos, type PhotoDocument } from '@/lib/api/photos';
import PhotoGrid from './PhotoGrid';

interface PhotosPageProps {
  householdId?: string | null;
}

export default function PhotosPage({ householdId }: PhotosPageProps) {
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
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('photos.title', { defaultValue: 'Photos' })}
          </h1>
          {!loading && !error && photos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('photos.count', { count: photos.length, defaultValue: '{{count}} photos' })}
            </p>
          )}
        </div>
      </div>

      <PhotoGrid
        photos={photos}
        loading={loading}
        error={error}
        onRefresh={loadPhotos}
      />
    </div>
  );
}
