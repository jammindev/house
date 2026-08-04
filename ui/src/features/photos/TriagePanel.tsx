import { CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import LoadError from '@/components/LoadError';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatDate } from '@/lib/format';
import type { DocumentItem, PhotoPurpose, TriageCluster } from '@/lib/api/documents';
import { useTriageQueue, useSetPhotosPurpose } from './hooks';
import PhotoGrid, { PhotoGridSkeleton } from './PhotoGrid';
import { PURPOSES } from './purposes';

interface TriagePanelProps {
  onPhotoClick: (photo: DocumentItem) => void;
}

/**
 * La file « À trier » — ce que personne n'a encore rangé, **par grappes de session**.
 *
 * Trente photos rapportées d'un week-end forment une décision, pas trente. Ce n'est
 * pas un confort : une file qui demande trente gestes ne se vide jamais, et une file
 * qu'on ne vide jamais cesse d'être lue au bout d'une semaine — c'est ce qui est
 * arrivé aux compteurs du Contrôle avant qu'ils ne soient bornés.
 *
 * Les grappes viennent du serveur : le compteur qu'affiche la pastille et le lot qu'on
 * envoie doivent désigner exactement les mêmes photos.
 */
export default function TriagePanel({ onPhotoClick }: TriagePanelProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useTriageQueue();
  const setPurpose = useSetPhotosPurpose();
  const showSkeleton = useDelayedLoading(isLoading);

  if (error) {
    return (
      <LoadError
        message={t('photos.loadFailed')}
        onRetry={() => void refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  if (showSkeleton) return <PhotoGridSkeleton />;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <EmptyState
        icon={CheckCheck}
        title={t('photos.triage.empty')}
        description={t('photos.triage.empty_description')}
      />
    );
  }

  // `total` compte tout ce qui reste ; les grappes montrées sont bornées. Dire l'un
  // en montrant l'autre est le seul moyen honnête de présenter une file tronquée —
  // un compteur qui ne vaut que pour l'écran ferait croire la file finie.
  const shown = data.clusters.reduce((sum, cluster) => sum + cluster.count, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {shown < data.total
          ? t('photos.triage.remainingPartial', { count: data.total, shown })
          : t('photos.triage.remaining', { count: data.total })}
      </p>

      {data.clusters.map((cluster) => (
        <ClusterCard
          key={cluster.key}
          cluster={cluster}
          onPhotoClick={onPhotoClick}
          onSort={(purpose) =>
            setPurpose.mutate({
              photoIds: cluster.photos.map((photo) => photo.id),
              purpose,
            })
          }
          isPending={setPurpose.isPending}
        />
      ))}
    </div>
  );
}

function ClusterCard({
  cluster,
  onPhotoClick,
  onSort,
  isPending,
}: {
  cluster: TriageCluster;
  onPhotoClick: (photo: DocumentItem) => void;
  onSort: (purpose: PhotoPurpose) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const from = formatDate(cluster.start);
  const to = formatDate(cluster.end);

  return (
    <Card className="space-y-3 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {from === to ? from : t('photos.triage.range', { from, to })}
        </h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t('photos.triage.count', { count: cluster.count })}
        </span>
      </div>

      <PhotoGrid photos={cluster.photos} onPhotoClick={onPhotoClick} />

      <div className="flex flex-wrap gap-2">
        {PURPOSES.map((spec) => {
          const Icon = spec.icon;
          return (
            <Button
              key={spec.key}
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={isPending}
              onClick={() => onSort(spec.key)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(spec.labelKey)}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
